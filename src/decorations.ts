/**
 * @author Hard.L
 * @desc 查找代码中的中文, 并标记
 */
import * as vscode from 'vscode'
import { findTextInVue } from './utils/findChineseInVue'
import { debounce } from 'lodash'

/**
 * 中文的标记，红框样式
 */
function getChineseCharDecoration() {
  // 配置提示框样式
  const hasOverviewRuler = vscode.workspace.getConfiguration('vue-i18n').get('showOverviewRuler')
  const shouldMark = vscode.workspace.getConfiguration('vue-i18n').get('markStringLiterals')
  const color = vscode.workspace.getConfiguration('vue-i18n').get('markColor')
  return vscode.window.createTextEditorDecorationType({
    borderWidth: shouldMark ? '1px' : undefined,
    borderStyle: shouldMark ? 'dotted' : undefined,
    overviewRulerColor: hasOverviewRuler ? color : undefined,
    overviewRulerLane: hasOverviewRuler ? vscode.OverviewRulerLane.Right : undefined,
    light: {
      borderColor: shouldMark ? color : undefined
    },
    dark: {
      borderColor: shouldMark ? color : undefined
    }
  })
}

/**
 * 更新标记
 */
export function updateDecorations() {
  const activeEditor = vscode.window.activeTextEditor
  const currentFilename = activeEditor.document.fileName
  const chineseCharDecoration = getChineseCharDecoration()
  if (!activeEditor) {
    return
  }

  const text = activeEditor.document.getText()
  // 清空上一次的保存结果
  let targetStrs = []
  let chineseChars: vscode.DecorationOptions[] = []
  let diagnosticMap: Map<string, vscode.Diagnostic[]> = new Map()
  targetStrs = findTextInVue(text)

  targetStrs.map(match => {
    const decoration = {
      range: match.range,
      hoverMessage: `检测到中文文案🇨🇳 ： ${match.text}`
    }
    chineseChars.push(decoration)
  })

  const shouldMark = vscode.workspace.getConfiguration('vue-i18n').get('markStringLiterals')
  if (shouldMark !== true) {
    return
  }

  /** 设置中文的提示 */
  activeEditor.setDecorations(chineseCharDecoration, chineseChars)

  return {
    targetStrs,
    chineseCharDecoration
  }
}

function decorations(ctx: vscode.ExtensionContext){

  const debounceUpdate = debounce(updateDecorations, 500);
  [
    vscode.window.onDidChangeActiveTextEditor,
    vscode.workspace.onDidChangeTextDocument
  ].forEach((onCahnge: any) => {
    onCahnge(debounceUpdate, null, ctx.subscriptions)
  })

  updateDecorations()

}

export default decorations
