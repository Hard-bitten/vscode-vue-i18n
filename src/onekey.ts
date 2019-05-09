import * as vscode from 'vscode'
import {replace,SAVE_TYPE} from './utils/transAndRefactor'
import i18nFiles from './utils/I18nFiles'
import {updateDecorations} from './decorations'
import Common from './utils/common'
import KeyDetector from './utils/KeyDetector'
/**
 * 公共文案替换
 */
function replaceCommmon(){
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return;
  }
  const { document } = activeEditor
  const text = activeEditor.document.getText();

  const { targetStrs } = updateDecorations();
  // 获取所有i18n,并把对象拍平
  const allTrans = i18nFiles.getAllTrans(document.fileName)
  const langObj = allTrans.filter(k=>k.lng==='zh-CN')[0].data
  const finalLangObj = Common.flatten(langObj) as any;

  const commandKeys = Object.keys(finalLangObj).filter(k => k.includes('common.'));
  if (targetStrs.length === 0 || commandKeys.length === 0) {
    vscode.window.showInformationMessage('没有找到可替换的公共文案');
    return;
  }

  // 生成所有匹配的的公共文案
  const replaceableStrs = targetStrs.reduce((prev, curr) => {
    const key = KeyDetector.findMatchKey(finalLangObj, curr.text);
    if (key && key.startsWith('common.')) {
      return prev.concat({
            target: curr,
            key
      })
    }
    return prev
  }, [])
  if (replaceableStrs.length === 0) {
    vscode.window.showInformationMessage('没有找到可替换的公共文案');
    return
  }
  vscode.window.showInformationMessage(
    `共找到 ${replaceableStrs.length} 处可自动替换的文案，是否替换？`,
    { modal: true },
    'Yes'
  ).then(action => {
    if (action === 'Yes') {
      replaceableStrs.reverse()
        .reduce((prev: Promise<any>, obj) => {
          return prev.then(() => {
            let {type,range} = obj.target
            return replace(type,obj.key,range)
          })
        }, Promise.resolve())
        .then(() => {
          vscode.window.showInformationMessage('替换完成')
        })
        .catch(e => {
          vscode.window.showErrorMessage(e.message)
        })
    }
  })
}

function oneKey(){
  vscode.commands.registerCommand(
    'extension.vue-i18n.replaceCommon',
    replaceCommmon
  )
}

export default oneKey