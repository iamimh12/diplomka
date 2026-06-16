# Как запускать
1) nodejs 20+ go 1.22 или docker 4.70+
2) поднятая база postgres (в /server/.env указать 2 переменные )
3) в корне проекта npm i -> npm run dev (чтобы запустить веб версию)
4) [тут открыт будет сайт](http://localhost:5173/)
5) http://localhost:5173

# Переменные для поднятия бэка 
(ссылка указана с хоста можно копирать ее но будут посты как на хосте)
* DATABASE_URL=postgresql://postgres:rAQxyfSrcHdsWsgcWErNIkWWYRVidjCj@switchback.proxy.rlwy.net:57116/railway
* JWT_SECRET=test

# Если нужна пустая база 
* DATABASE_URL=postgresql://postgres:xbXvzzVMmdhhOKBKbpnQnxNaCYafQSsk@thomas.proxy.rlwy.net:59674/railway
* JWT_SECRET=test