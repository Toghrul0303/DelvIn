"use client"

import { memo, useCallback, useRef, type MouseEvent, type PointerEvent } from "react"
import {
  createShapeId,
  DefaultContextMenu,
  DefaultToolbar,
  DrawToolbarItem,
  EraserToolbarItem,
  HandToolbarItem,
  SelectToolbarItem,
  TextToolbarItem,
  TldrawUiButtonIcon,
  TldrawUiContextualToolbar,
  TldrawUiToolbarButton,
  useEditor,
  useTranslation,
  useValue,
  type Editor,
  type TLComponents,
  type TLShape,
  type TLShapeId,
  type TLStore,
  type TLUiContextMenuProps,
  type TLUiOverrides,
} from "tldraw"
import { Calculator, CircleHelp } from "lucide-react"
import { DESK_CAMERA_EVENT } from "@/lib/desk-events"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useMode } from "../mode-context"
import { useLanguage } from "../language-context"
import { useExplainMode } from "../explain-mode-context"
import { DeskTldraw } from "./desk-tldraw"
import { findCalculatorShape, toggleCalculatorShape } from "./desk-calculator-shape"
import { DESK_CARD_TYPE } from "./desk-card-shape"
import {
  asShapeIdList,
  BOARD_BRANCH_TYPE,
  BOARD_CHART_TYPE,
  BOARD_FIGURE_TYPE,
  BOARD_QUESTION_TYPE,
  BOARD_RESULT_TYPE,
  BOARD_STEP_TYPE,
  isBoardQuestionShape,
} from "./board-constants"

const DUPLICATE_OFFSET = { x: 20, y: 20 }

const GENERATED_SHAPE_TYPES = new Set<string>([
  BOARD_QUESTION_TYPE,
  BOARD_STEP_TYPE,
  BOARD_RESULT_TYPE,
  BOARD_CHART_TYPE,
  BOARD_FIGURE_TYPE,
  BOARD_BRANCH_TYPE,
  DESK_CARD_TYPE,
])

function selectionIsGenerated(editor: Editor) {
  const walk = (shape: TLShape): boolean => {
    if (GENERATED_SHAPE_TYPES.has(shape.type)) return true
    if (shape.type === "arrow") {
      return editor.getBindingsInvolvingShape(shape.id).some((binding) => {
        const to = editor.getShape(binding.toId)
        return Boolean(to && to.id !== shape.id && GENERATED_SHAPE_TYPES.has(to.type))
      })
    }
    if (shape.type !== "group") return false
    for (const childId of editor.getSortedChildIdsForParent(shape.id)) {
      const child = editor.getShape(childId)
      if (child && walk(child)) return true
    }
    return false
  }
  return editor.getSelectedShapes().some((shape) => walk(shape))
}

function generatedRoot(editor: Editor, shape: TLShape): TLShape {
  let current = shape
  const seen = new Set<string>()
  while (!seen.has(current.id)) {
    seen.add(current.id)
    if (isBoardQuestionShape(current)) return current
    const props = current.props as { parentId?: string; branchFromId?: string }
    const nextId = props.parentId || props.branchFromId
    if (!nextId) return current
    const next = editor.getShape(nextId as TLShapeId)
    if (!next || !GENERATED_SHAPE_TYPES.has(next.type)) return current
    current = next
  }
  return current
}

function collectCluster(editor: Editor, root: TLShape): TLShape[] {
  const seen = new Set<string>()
  const out: TLShape[] = []
  const visit = (shape: TLShape) => {
    if (seen.has(shape.id)) return
    seen.add(shape.id)
    out.push(shape)
    const props = shape.props as { childIds?: unknown; arrowIds?: unknown }
    for (const childId of asShapeIdList(props.childIds)) {
      const child = editor.getShape(childId)
      if (child) visit(child)
    }
    for (const arrowId of asShapeIdList(props.arrowIds)) {
      const arrow = editor.getShape(arrowId)
      if (arrow) visit(arrow)
    }
    for (const binding of editor.getBindingsInvolvingShape(shape.id)) {
      const otherId = binding.fromId === shape.id ? binding.toId : binding.fromId
      const other = editor.getShape(otherId)
      if (other?.type === "arrow") visit(other)
    }
    for (const child of editor.getCurrentPageShapes()) {
      if (child.parentId === shape.id) visit(child)
    }
  }
  visit(root)
  return out
}

function remapValue(value: unknown, idMap: Map<string, TLShapeId>): unknown {
  if (typeof value === "string") return idMap.get(value) ?? value
  if (Array.isArray(value)) return value.map((item) => remapValue(item, idMap))
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) next[key] = remapValue(child, idMap)
    return next
  }
  return value
}

function cloneCluster(editor: Editor, root: TLShape): TLShapeId[] {
  const shapes = collectCluster(editor, root)
  const idMap = new Map<string, TLShapeId>()
  for (const shape of shapes) idMap.set(shape.id, createShapeId())
  const pageId = editor.getCurrentPageId()
  const bindings: { type: string; fromId: TLShapeId; toId: TLShapeId; props: object }[] = []
  const seenBindings = new Set<string>()
  for (const shape of shapes) {
    for (const binding of editor.getBindingsInvolvingShape(shape.id)) {
      if (seenBindings.has(binding.id)) continue
      const fromId = idMap.get(binding.fromId)
      const toId = idMap.get(binding.toId)
      if (!fromId || !toId) continue
      seenBindings.add(binding.id)
      bindings.push({
        type: binding.type,
        fromId,
        toId,
        props: JSON.parse(JSON.stringify(binding.props)) as object,
      })
    }
  }
  editor.createShapes(
    shapes.map((shape) => ({
      id: idMap.get(shape.id)!,
      type: shape.type,
      x: shape.x + DUPLICATE_OFFSET.x,
      y: shape.y + DUPLICATE_OFFSET.y,
      rotation: shape.rotation,
      opacity: shape.opacity,
      isLocked: shape.isLocked,
      parentId: shape.parentId === pageId ? pageId : (idMap.get(shape.parentId) ?? shape.parentId),
      props: remapValue(JSON.parse(JSON.stringify(shape.props)), idMap),
    })) as Parameters<Editor["createShapes"]>[0],
  )
  if (bindings.length > 0) {
    editor.createBindings(bindings as Parameters<Editor["createBindings"]>[0])
  }
  return shapes.map((shape) => idMap.get(shape.id)!)
}

function deleteCanvasSelection(editor: Editor) {
  const ids = new Set<TLShapeId>()
  for (const shape of editor.getSelectedShapes()) {
    if (GENERATED_SHAPE_TYPES.has(shape.type)) {
      for (const member of collectCluster(editor, generatedRoot(editor, shape))) ids.add(member.id)
    } else {
      ids.add(shape.id)
    }
  }
  if (ids.size === 0) return
  editor.markHistoryStoppingPoint("delete")
  editor.run(() => {
    editor.deleteShapes([...ids])
  }, { ignoreShapeLock: true })
}

function duplicateCanvasSelection(editor: Editor) {
  const plain: TLShapeId[] = []
  const roots = new Map<string, TLShape>()
  for (const shape of editor.getSelectedShapes()) {
    if (GENERATED_SHAPE_TYPES.has(shape.type)) {
      const root = generatedRoot(editor, shape)
      roots.set(root.id, root)
    } else {
      plain.push(shape.id)
    }
  }
  const created: TLShapeId[] = []
  editor.markHistoryStoppingPoint("duplicate")
  editor.run(() => {
    if (plain.length > 0) {
      editor.duplicateShapes(plain, DUPLICATE_OFFSET)
      created.push(...editor.getSelectedShapeIds())
    }
    for (const root of roots.values()) created.push(...cloneCluster(editor, root))
    if (created.length > 0) editor.setSelectedShapes(created)
  }, { ignoreShapeLock: true })
}

function DeskGeneratedContextMenu(props: TLUiContextMenuProps) {
  const editor = useEditor()
  const disabled = useValue(
    "generated-context-menu",
    () => selectionIsGenerated(editor),
    [editor],
  )
  return <DefaultContextMenu {...props} disabled={disabled} />
}

function SlimToolbar() {
  const editor = useEditor()
  const mobile = useMediaQuery("(max-width: 767px)")
  const { t } = useLanguage()
  const { armed, setArmed } = useExplainMode()
  const calculatorOpen = useValue(
    "calculator-shape-present",
    () => Boolean(findCalculatorShape(editor)),
    [editor],
  )

  return (
    <DefaultToolbar orientation={mobile ? "horizontal" : "vertical"} minItems={7} maxItems={7}>
      <SelectToolbarItem />
      <HandToolbarItem />
      <DrawToolbarItem />
      <EraserToolbarItem />
      <TextToolbarItem />
      <TldrawUiToolbarButton
        type="tool"
        title={t("chat.explain")}
        tooltip={t("chat.explain")}
        isActive={armed}
        onClick={() => setArmed(!armed)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CircleHelp className="size-[18px] shrink-0 stroke-current" aria-hidden="true" />
      </TldrawUiToolbarButton>
      <TldrawUiToolbarButton
        type="tool"
        title={t("desk.calculator")}
        tooltip={t("desk.calculator")}
        isActive={calculatorOpen}
        onClick={() => toggleCalculatorShape(editor)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Calculator className="size-[18px] shrink-0 stroke-current" aria-hidden="true" />
      </TldrawUiToolbarButton>
    </DefaultToolbar>
  )
}

function useSingleTap(onAction: () => void) {
  const gesture = useRef({ ran: false })
  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    gesture.current.ran = false
  }, [])
  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.detail === 0) {
        onAction()
        return
      }
      if (gesture.current.ran) return
      gesture.current.ran = true
      onAction()
    },
    [onAction],
  )
  return { onPointerDown, onClick }
}

function DeskTapButton({
  title,
  icon,
  onAction,
}: {
  title: string
  icon: "trash" | "duplicate"
  onAction: () => void
}) {
  const handlers = useSingleTap(onAction)
  return (
    <TldrawUiToolbarButton type="icon" title={title} {...handlers}>
      <TldrawUiButtonIcon icon={icon} />
    </TldrawUiToolbarButton>
  )
}

function SelectionActionsToolbar() {
  const editor = useEditor()
  const msg = useTranslation()
  const show = useValue(
    "selection-actions",
    () => editor.getSelectedShapeIds().length > 0 && editor.isIn("select.idle"),
    [editor],
  )
  const getSelectionBounds = useCallback(() => editor.getSelectionScreenBounds(), [editor])
  const deleteSelection = useCallback(() => {
    deleteCanvasSelection(editor)
  }, [editor])
  const duplicateSelection = useCallback(() => {
    duplicateCanvasSelection(editor)
  }, [editor])
  if (!show) return null
  return (
    <TldrawUiContextualToolbar
      className="desk-selection-toolbar"
      getSelectionBounds={getSelectionBounds}
      label="Selection actions"
    >
      <DeskTapButton title={msg("action.delete")} icon="trash" onAction={deleteSelection} />
      <DeskTapButton title={msg("action.duplicate")} icon="duplicate" onAction={duplicateSelection} />
    </TldrawUiContextualToolbar>
  )
}

const deskTldrawComponents: TLComponents = {
  Toolbar: SlimToolbar,
  ContextMenu: DeskGeneratedContextMenu,
  InFrontOfTheCanvas: SelectionActionsToolbar,
  MainMenu: null,
  HelpMenu: null,
  PageMenu: null,
  Minimap: null,
  StylePanel: null,
  NavigationPanel: null,
  DebugPanel: null,
  DebugMenu: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  KeyboardShortcutsDialog: null,
  HelperButtons: null,
  QuickActions: null,
  ImageToolbar: null,
  VideoToolbar: null,
  PeopleMenu: null,
  CursorChatBubble: null,
  ZoomMenu: null,
}

const deskUiOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    const keep = new Set(["select", "hand", "draw", "eraser", "text"])
    for (const id of Object.keys(tools)) {
      if (!keep.has(id)) delete tools[id]
    }
    return tools
  },
  actions(editor, actions) {
    const del = actions.delete
    if (del) del.onSelect = () => deleteCanvasSelection(editor)
    const duplicate = actions.duplicate
    if (duplicate) duplicate.onSelect = () => duplicateCanvasSelection(editor)
    const ungroup = actions.ungroup
    if (ungroup) {
      const prev = ungroup.onSelect.bind(ungroup)
      ungroup.onSelect = (source) => {
        if (selectionIsGenerated(editor)) return
        return prev(source)
      }
    }
    return actions
  },
}

export const DeskEditor = memo(function DeskEditor({
  store,
  boardId,
  onEditor,
}: {
  store: TLStore
  boardId: string
  onEditor: (editor: Editor | null) => void
}) {
  const { dark } = useMode()
  const onEditorRef = useRef(onEditor)
  onEditorRef.current = onEditor

  const handleMount = useCallback((editor: Editor) => {
    onEditorRef.current(editor)
    const unsub = editor.store.listen(
      () => {
        window.dispatchEvent(new Event(DESK_CAMERA_EVENT))
      },
      { source: "user", scope: "session" },
    )
    return () => {
      unsub()
    }
  }, [])

  const frozenId = useRef<string | null>(null)
  const frozenStore = useRef<TLStore | null>(null)
  if (!frozenStore.current || (boardId !== frozenId.current && boardId)) {
    frozenId.current = boardId
    frozenStore.current = store
  }

  const stableStore = frozenStore.current ?? store

  return (
    <div className="desk-tldraw absolute inset-0">
      <DeskTldraw
        key="DelvIn-desk"
        store={stableStore}
        components={deskTldrawComponents}
        overrides={deskUiOverrides}
        onMount={handleMount}
        colorScheme={dark ? "dark" : "light"}
      />
    </div>
  )
})
