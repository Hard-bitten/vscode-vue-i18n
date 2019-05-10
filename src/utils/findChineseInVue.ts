import * as vscode from 'vscode'
// import * as vueCompiler from 'vue-template-compiler'
import {parseHTML} from './parser/html-parser'
import { SAVE_TYPE } from './transAndRefactor'
const DOUBLE_BYTE_REGEX = /[^\x00-\xff]/g;
const CHINESE_REGEX = /\p{Unified_Ideograph}/ug;
const CHINESE_STR_REGEX = /[\u4e00-\u9fa5]/ug;
export enum CHINESE_AREA {
  CONTENT,
  PROP,
  // JS,
  NULL
}

/**
 * 查找 Vue 文件中的中文
 * @param code
 */
export function findTextInVue(code) {
  const matches = [];
  let isScript = false
  const b = parseHTML(code, {
    warn:(msg, range)=> {
      console.error(`[Vue compiler]: ${msg}`)
    },
    expectHTML: false,
    isUnaryTag: false,
    canBeLeftOpenTag: null,
    shouldDecodeNewlines: false,
    shouldDecodeNewlinesForHref: false,
    shouldKeepComment: false,
    outputSourceRange: true,
    start (tag, attrs, unary, start, end ,range) {
      if(tag === 'script'){
        isScript = true
        // TODO 对data部分进行识别
        return
      }
      // console.log(tag,attrs,start,end,range)
      attrs.forEach(attr=>{
        if(attr.value.match(DOUBLE_BYTE_REGEX)){
          const trimStart = new vscode.Position(attr.range.line, attr.range.start)
          const trimEnd = new vscode.Position(attr.range.line, attr.range.end)
          const ranges = new vscode.Range(trimStart, trimEnd);
          const text = code.slice(attr.start, attr.end)
          // TODO 此处应对属性进行细化，如属性类型，具体哪部分是中文
          matches.push({
            type: SAVE_TYPE.$t,
            range: ranges,
            text,
            area: CHINESE_AREA.PROP,
            chineseText: attr.value,
            prop: attr.name
          })
        }
      })
    },
    end (tag, start, end) {
      // console.log(tag, start, end)
    },
    chars (text, start, end, textRange) {
      if(isScript){
        isScript = true
        return
      }
      if(text.match(CHINESE_REGEX)){
        const ltrim = text.replace(/(^\s*)/g,'')
        const rtrim = text.replace(/(\s*$)/g,'')
        const trimStart = new vscode.Position(textRange.startLine, textRange.startCol + (text.length-ltrim.length))
        const trimEnd = new vscode.Position(textRange.endLine, textRange.endCol + (text.length-rtrim.length))
        const ranges = new vscode.Range(trimStart, trimEnd);
        matches.push({
          type: SAVE_TYPE.$t,
          range: ranges,
          text: code.slice(start,end),
          area: CHINESE_AREA.CONTENT,
          chineseText: text.match(CHINESE_STR_REGEX).join('')
        })
      }
      // console.log(text, start, end,textRange)
    },
    comment (text, start, end) {
      // console.log(text, start, end)
    }
  })
  // visitComponent(ast)
  return matches
}