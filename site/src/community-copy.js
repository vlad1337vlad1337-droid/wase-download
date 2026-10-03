// Compact labels shared by static HTML and progressive enhancement.
const rows={
 en:['Save','Save this page','Share','Copy link','Link copied','Select and copy the link','Bookmark','Close','Star on GitHub','GitHub stars'],
 ru:['Сохранить','Сохранить страницу','Поделиться','Копировать ссылку','Ссылка скопирована','Выделите и скопируйте ссылку','В закладки','Закрыть','Поставить звезду на GitHub','Звёзды GitHub'],
 zh:['保存','保存此页面','分享','复制链接','链接已复制','选择并复制链接','添加书签','关闭','在 GitHub 上加星','GitHub 星标'],
 es:['Guardar','Guardar esta página','Compartir','Copiar enlace','Enlace copiado','Selecciona y copia el enlace','Marcador','Cerrar','Dar una estrella en GitHub','Estrellas de GitHub'],
 fr:['Enregistrer','Enregistrer cette page','Partager','Copier le lien','Lien copié','Sélectionnez et copiez le lien','Favori','Fermer','Ajouter une étoile sur GitHub','Étoiles GitHub'],
 de:['Speichern','Diese Seite speichern','Teilen','Link kopieren','Link kopiert','Link auswählen und kopieren','Lesezeichen','Schließen','Auf GitHub einen Stern geben','GitHub-Sterne'],
 pt:['Salvar','Salvar esta página','Compartilhar','Copiar link','Link copiado','Selecione e copie o link','Favorito','Fechar','Dar uma estrela no GitHub','Estrelas no GitHub'],
 it:['Salva','Salva questa pagina','Condividi','Copia link','Link copiato','Seleziona e copia il link','Segnalibro','Chiudi','Aggiungi una stella su GitHub','Stelle GitHub'],
 tr:['Kaydet','Bu sayfayı kaydet','Paylaş','Bağlantıyı kopyala','Bağlantı kopyalandı','Bağlantıyı seçip kopyalayın','Yer imi','Kapat','GitHub’da yıldız ver','GitHub yıldızları'],
 ja:['保存','このページを保存','共有','リンクをコピー','コピーしました','リンクを選択してコピー','ブックマーク','閉じる','GitHub でスターを付ける','GitHub スター'],
 ko:['저장','이 페이지 저장','공유','링크 복사','링크 복사됨','링크를 선택하고 복사하세요','북마크','닫기','GitHub에서 별표 추가','GitHub 별표'],
 ar:['حفظ','حفظ هذه الصفحة','مشاركة','نسخ الرابط','تم نسخ الرابط','حدد الرابط وانسخه','إشارة مرجعية','إغلاق','إضافة نجمة على GitHub','نجوم GitHub'],
 hi:['सहेजें','यह पेज सहेजें','शेयर करें','लिंक कॉपी करें','लिंक कॉपी हुआ','लिंक चुनकर कॉपी करें','बुकमार्क','बंद करें','GitHub पर स्टार दें','GitHub स्टार']
};
export const communityCopy=Object.fromEntries(Object.entries(rows).map(([lang,row])=>[lang,Object.fromEntries(['save','title','share','copy','copied','manual','bookmark','close','star','stars'].map((key,index)=>[key,row[index]]))]));
for(const [lang,text]of Object.entries({en:'Bookmarks: browser menu',ru:'Закладки: меню браузера',zh:'书签：浏览器菜单',es:'Marcadores: menú del navegador',fr:'Favoris : menu du navigateur',de:'Lesezeichen: Browsermenü',pt:'Favoritos: menu do navegador',it:'Segnalibri: menu del browser',tr:'Yer imleri: tarayıcı menüsü',ja:'ブックマーク：ブラウザーのメニュー',ko:'북마크: 브라우저 메뉴',ar:'الإشارات المرجعية: قائمة المتصفح',hi:'बुकमार्क: ब्राउज़र मेन्यू'}))communityCopy[lang].mobileBookmark=text;
