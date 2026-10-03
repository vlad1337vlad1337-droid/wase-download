// SPDX-License-Identifier: MIT
// Describes the actual default server path and limited browser fallback.
export const privacy = {
 ru: {
  privacyTitle:'Как мы обрабатываем файлы',
  privacyText:'По умолчанию конвертация выполняется на нашем сервере. Файл отправляется только после нажатия «Конвертировать». Регистрация не требуется.',
  privacySections:[
   ['Загрузка и конвертация','Выбор, перетаскивание и вставка файла добавляют его в список в вашем браузере. До запуска конвертации содержимое не отправляется на сервер. При обработке файл передаётся нашему конвертеру; сервис не использует сторонний API конвертации.'],
   ['Временные файлы и результат','Исходник и результат нужны только для выполнения задания. Сервер удаляет рабочую папку после завершения передачи результата, ошибки или отмены. Публичная ссылка и история файлов не создаются. При аварийном завершении сервера очистка может потребовать технического обслуживания. Скачанный вами файл остаётся у вас.'],
   ['Если сервер недоступен','Для некоторых изображений доступна резервная обработка прямо в браузере, без отправки содержимого на сервер. Это ограниченный режим, а не способ обработки всех форматов. Под конвертером в этом случае указано «Без загрузки на сервер».'],
   ['Технические данные и статистика','Для работы и защиты сервиса сервер использует IP-адрес и сведения о запросах, включая адрес страницы, время, статус ответа и данные браузера. Доступ к техническим журналам нужен для обслуживания. Если настроена Яндекс Метрика, она включается только после вашего согласия; содержимое и имена выбранных файлов в неё не передаются. Согласие можно изменить через «Настройки аналитики» внизу страницы.'],
   ['Настройки в браузере','В локальном хранилище сохраняются выбранная тема, язык, решение об аналитике и публичный список форматов на срок до 24 часов для более быстрого открытия конвертера. Это настройки интерфейса, а не сохранённые загруженные файлы. Список файлов существует в текущей вкладке и исчезает при обновлении страницы.']
  ]
 },
 en: {
  privacyTitle:'How we handle files',
  privacyText:'Conversion normally runs on our server. Files are uploaded only when you press Convert. No account is required.',
  privacySections:[
   ['Upload and conversion','Selecting, dropping or pasting a file adds it to your browser’s list. Its contents are not uploaded until conversion starts. Our own converter processes uploads without a third-party conversion API.'],
   ['Temporary files and results','Inputs and outputs are used for the current job. The server removes its working folder after sending the result, an error or cancellation. No public file link or file history is created. An abrupt server failure may require maintenance to remove leftovers. Files you download remain with you.'],
   ['When the server is unavailable','Some images can use a limited browser fallback without uploading their contents. This does not support every format. In this mode the converter displays “No upload”.'],
   ['Technical data and analytics','For operation and security, the server uses IP addresses and request details such as page address, time, response status and browser information. Technical logs are used for maintenance. If configured, Yandex Metrica starts only with your consent; selected file names and contents are not sent to it. You can change consent through Analytics settings in the footer.'],
   ['Browser preferences','Local storage keeps your theme, language, analytics choice and the public format catalogue for up to 24 hours to speed up repeat visits, not uploaded files. The file list belongs to the current tab and disappears when you reload the page.']
  ]
 },
 zh: {
  privacyTitle:'我们如何处理文件',
  privacyText:'默认在我们的服务器上转换。只有点击“转换”后才上传文件，无需注册。',
  privacySections:[
   ['上传与转换','选择、拖放或粘贴文件只会将其加入浏览器列表，开始转换前不会上传内容。文件由我们自建的转换器处理，不使用第三方转换 API。'],
   ['临时文件与结果','输入和输出文件仅用于当前任务。服务器在发送结果、发生错误或取消后删除工作目录，不创建公开文件链接或文件历史。服务器意外终止时，残留文件可能需要维护清理。您下载的文件保留在您自己的设备上。'],
   ['服务器不可用时','部分图片可以在浏览器中以有限的备用模式转换，无需上传内容。该模式不支持全部格式，并显示“无需上传”。'],
   ['技术数据与统计','服务器为运行和安全使用 IP 地址及请求信息，包括页面地址、时间、响应状态和浏览器信息。技术日志用于维护。若配置了 Yandex Metrica，仅在您同意后启用，不发送所选文件的名称或内容。可通过页脚的统计设置修改同意选项。'],
   ['浏览器设置','本地存储保存主题、语言、统计选择及最长 24 小时的公开格式列表，以加快再次访问；不保存上传文件。文件列表仅存在于当前标签页，刷新页面后消失。']
  ]
 }
};
