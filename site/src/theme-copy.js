// SPDX-License-Identifier: MIT
const rows={
 en:['Coffee','Theme','Auto','Light','Dark'],
 ru:['На кофе','Тема','Авто','Светлая','Тёмная'],
 zh:['请喝咖啡','主题','自动','浅色','深色'],
 es:['Un café','Tema','Auto','Claro','Oscuro'],
 fr:['Un café','Thème','Auto','Clair','Sombre'],
 de:['Kaffee','Design','Auto','Hell','Dunkel'],
 pt:['Um café','Tema','Auto','Claro','Escuro'],
 it:['Un caffè','Tema','Auto','Chiaro','Scuro'],
 tr:['Kahve','Tema','Otomatik','Açık','Koyu'],
 ja:['コーヒー','テーマ','自動','ライト','ダーク'],
 ko:['커피 한 잔','테마','자동','라이트','다크'],
 ar:['قهوة','المظهر','تلقائي','فاتح','داكن'],
 hi:['कॉफ़ी','थीम','अपने आप','हल्की','गहरी']
};
export const themeCopy=Object.fromEntries(Object.entries(rows).map(([lang,[coffee,theme,auto,light,dark]])=>[lang,{coffee,theme,auto,light,dark}]));
