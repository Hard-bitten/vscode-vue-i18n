import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

import Common from './utils/Common'
import i18nFiles from './utils/i18nFiles'
import {findTextInVue} from './utils/findChineseInVue'
import {lineToUpperCase} from './utils/transAndRefactor'
const EVENT_MAP = {
  ready: 'ready',
  allI18n: 'allI18n',
  trans: 'trans',
  writeTrans: 'writeTrans',
  batchExtract: 'batchExtract',
  extractResult: 'extractResult',
  transAndRefactor:'transAndRefactor'
}

export class TransCenter {
  panel: vscode.WebviewPanel = null
  filePath: string = null
  shortFileName: string = null
  baseKey: string = null
  constructor(filePath: string) {
    this.filePath = filePath
    this.shortFileName = filePath
      .split(path.sep)
      .slice(-3)
      .join(path.sep)
    
    this.baseKey = filePath
      .replace('.vue','')
      .split(path.sep)
      .slice(-2)
      .map(lineToUpperCase)
      .join('.')
      
    this.panel = vscode.window.createWebviewPanel(
      'transCenter',
      `翻译-${this.shortFileName}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    )

    const { webview } = this.panel

    webview.html = fs.readFileSync(
      path.resolve(Common.extension.extensionPath, 'static/transCenter.html'),
      'utf-8'
    )

    this.initMessage()
    this.initFileWatcher()
  }

  initMessage() {
    const {
      panel: { webview },
      shortFileName,
      filePath
    } = this

    const onMessage = ({ type, data }) => {
      switch (type) {
        case EVENT_MAP.ready:
          webview.postMessage({
            type: EVENT_MAP.allI18n,
            data: {
              filePath: shortFileName,
              i18n: i18nFiles.getTrans(filePath)
            }
          })
          break

        case EVENT_MAP.trans:
          data.forEach(async i18nItem => {
            try {
              const transItemsResult = await i18nFiles.getTransByApi(
                i18nItem.transItems
              )
              const newI18nItem = {
                ...i18nItem,
                transItems: transItemsResult
              }
              webview.postMessage({
                type: EVENT_MAP.trans,
                data: newI18nItem
              })
              i18nFiles.writeTrans(filePath, newI18nItem)
            } catch (err) {
              console.error(err)
              webview.postMessage({
                type: EVENT_MAP.trans,
                data: i18nItem
              })
            }
          })
          break

        case EVENT_MAP.writeTrans:
          i18nFiles.writeTrans(filePath, data)
          break

        case EVENT_MAP.batchExtract:
          const text = fs.readFileSync(this.filePath, 'utf-8')
          const matches = findTextInVue(text)
          
          if(matches && matches.length > 0 ){
            let extractMap = {}
            matches.forEach(match=>{
              if(extractMap[match.chineseText]){
                extractMap[match.chineseText].range.push(match.range)
              }else{
                extractMap[match.chineseText]={
                  key:`${this.baseKey}.${Common.getUid()}`,
                  transItems:[
                    {
                      lng:'zh-CN',
                      data: match.chineseText
                    }
                  ],
                  range:[match.range]
                }
              } 
            })
            const result = Object.keys(extractMap).map(key=>extractMap[key])
            webview.postMessage({
              type: EVENT_MAP.extractResult,
              data: result
            })
          }

          break

        default:
        //
      }
    }

    webview.onDidReceiveMessage(onMessage)
  }

  initFileWatcher() {
    const {
      panel,
      panel: { webview },
      shortFileName,
      filePath
    } = this
    const watcher = vscode.workspace.createFileSystemWatcher(filePath)

    const updateI18n = () => {
      webview.postMessage({
        type: EVENT_MAP.allI18n,
        data: {
          filePath: shortFileName,
          i18n: i18nFiles.getTrans(filePath)
        }
      })
    }

    watcher.onDidChange(updateI18n)
    panel.onDidDispose(() => watcher.dispose())
  }
}

export default (ctx: vscode.ExtensionContext) => {
  const cmd = vscode.commands.registerCommand(
    'extension.vue-i18n.transCenter',
    () => {
      new TransCenter(vscode.window.activeTextEditor.document.fileName)
    }
  )

  ctx.subscriptions.push(cmd)
}
