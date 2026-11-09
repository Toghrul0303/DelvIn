"use client"

import { memo, useCallback, useRef, type MouseEvent, type PointerEvent } from "react"
import {
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
  useActions,
  useEditor,
  useTranslation,
  useValue,
  type Editor,
  type TLComponents,
  type TLShape,
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
  BOARD_BRANCH_TYPE,
  BOARD_CHART_TYPE,
  BOARD_FIGURE_TYPE,
  BOARD_QUESTION_TYPE,
  BOARD_RESULT_TYPE,
  BOARD_STEP_TYPE,
} from "./board-constants"

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
  const actions = useActions()
  const msg = useTranslation()
  const show = useValue(
    "selection-actions",
    () => editor.getSelectedShapeIds().length > 0 && editor.isIn("select.idle"),
    [editor],
  )
  const getSelectionBounds = useCallback(() => editor.getSelectionScreenBounds(), [editor])
  const deleteSelection = useCallback(() => {
    void actions.delete?.onSelect("actions-menu")
  }, [actions])
  const duplicateSelection = useCallback(() => {
    void actions.duplicate?.onSelect("actions-menu")
  }, [actions])
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
    const selectionIsGeneratedNow = () => selectionIsGenerated(editor)
    for (const id of ["delete", "ungroup"] as const) {
      const action = actions[id]
      if (!action) continue
      const prev = action.onSelect.bind(action)
      action.onSelect = (source) => {
        if (selectionIsGeneratedNow()) return
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
