import {additionalNotFound} from './locales.js';
// SPDX-License-Identifier: MIT
export const notFound={
 ru:{title:'Эта страница потерялась',text:'Кажется, ссылка свернула не туда. Конвертер всё ещё здесь.',home:'К конвертеру',formats:'Все форматы'},
 en:{title:'This page wandered off',text:'Looks like this link took a wrong turn. The converter is still here.',home:'Back to converter',formats:'All formats'},
 zh:{title:'这个页面迷路了',text:'链接似乎走错了方向，转换器还在这里。',home:'返回转换器',formats:'所有格式'}
};

Object.assign(notFound,additionalNotFound);
