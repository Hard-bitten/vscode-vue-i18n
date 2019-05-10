import * as path from 'path'
import * as vscode from 'vscode'
import i18nFiles from './i18nFiles'
import Common from './Common'
import {CHINESE_AREA} from './findChineseInVue'

const PROP_REG = /[_a-zA-Z][_a-zA-Z0-9]*\=[\'|\"][\u4e00-\u9fa5]*[\'|\"]$/g
const CONTENT_REG = /[\u4e00-\u9fa5]*/g

export enum SAVE_TYPE {
  $t,
  i18n
}

export const lineToUpperCase = str => {
  return str.replace(/(-\w)/g, $1 => {
    return $1[1].toUpperCase()
  })
}

export function replace(type: SAVE_TYPE, key: string, range: vscode.Range, value: string) {
  if (type === SAVE_TYPE.i18n) {
    const newStart = range.start.with(range.start.line, range.start.character - 1);
    const newEnd = range.end.with(range.end.line, range.end.character + 1);
    range = range.with(newStart, newEnd);
  }
  return vscode.window.activeTextEditor.edit(editBuilder => {
    editBuilder.replace(range, value);
  });
}

const transAndRefactor = async ({
  filePath,
  text,
  type,
  range
}: {
  filePath: string;
  text: string;
  type: SAVE_TYPE;
  range: vscode.Range;
}) => {
  // 针对选择的内容进行模式识别
  let areaType:CHINESE_AREA = CHINESE_AREA.NULL
  let newText = ''
  let prop = ''
  if(PROP_REG.test(text)){
    prop = text.split('=')[0]
    newText = text.split('=')[1].replace(/\'|\"/g,'')
    areaType = CHINESE_AREA.PROP
  }else if(CONTENT_REG.test(text)){
    newText = text
    areaType = CHINESE_AREA.CONTENT
  }

  if(areaType === CHINESE_AREA.NULL){
    vscode.window.showErrorMessage('请选择中文标签内容或中文属性')
    return
  }


  let relativeName: any = path.relative(
    vscode.workspace.rootPath,
    vscode.window.activeTextEditor.document.fileName
  )
  relativeName = path.parse(relativeName)

  // splice(1) 去掉 src 目录
  let defaultKey = relativeName.dir
    .split(path.sep)
    .splice(1)
    .filter(key => key)
    .concat(relativeName.name)
    .map(lineToUpperCase)

  if (defaultKey.length > 1) {
    defaultKey = defaultKey.splice(1)
  }

  defaultKey = `${defaultKey.join('.')}.${Common.getUid()}`

  let key = await vscode.window.showInputBox({
    prompt: `请输入要保存的路径 (例如:home.document.title)`,
    valueSelection: [defaultKey.lastIndexOf('.') + 1, defaultKey.length],
    value: defaultKey
  })

  if (!key) {
    return
  }

  const i18nFile = i18nFiles.getI18nFileByPath(filePath)
  let transData: any = i18nFile.getTransByKey(key)
  let firstTransData = transData[0]

  // 如果是目录，添加前缀
  if (firstTransData.isDirectory && key.split('.').length === 1) {
    key = `common.${key}`
    transData = i18nFile.getLngFilesByKey(key)
    firstTransData = transData[0]
  }

  // 已有翻译检测
  if (firstTransData.data) {
    const okText = '覆盖'
    const isReplace = await vscode.window.showInformationMessage(
      `已有对应翻译【${firstTransData.data}】, 覆盖吗？`,
      { modal: true },
      okText
    )

    if (isReplace !== okText) {
      return
    }
  }

  var value = ''
  switch(areaType){
    case CHINESE_AREA.PROP:
      value = type === SAVE_TYPE.$t ? `:${prop}="$t('${key}')"` : `:${prop}="i18n.t('${key}')"`
      break
    case CHINESE_AREA.CONTENT:
      value = type === SAVE_TYPE.$t ? `{{$t('${key}')}}` : `i18n.t('${key}')`
      break
    // case CHINESE_AREA.JS:
    //   value = type === SAVE_TYPE.$t ? `{{this.$t('${key}')}}` : `this.i18n.t('${key}')`
    //   break
    default:
      break
  }

  // 替换内容
  replace(type, key, range, value)

  // 写入翻译
  const transZhCN = transData.find(item => item.lng === 'zh-CN')
  transZhCN.data = newText

  const transByApiData = await i18nFiles.getTransByApi(transData)
  i18nFile.writeTransByKey(key, transByApiData)

  // 提示翻译
  const transEn = transData.find(item => item.lng === 'en')
  transEn && vscode.window.showInformationMessage(`翻译结果: ${transEn.data}`)
}

export default transAndRefactor



