# 🎬 Cinemas Valladolid — Guía de Despliegue en Producción

> Esta guía documenta paso a paso cómo se desplegó la aplicación **Cinemas Valladolid** en un servidor real de DigitalOcean con 512 MB de RAM. Está escrita para que cualquier persona, sin experiencia previa en servidores, pueda entenderla y repetirla.

---

## ¿Qué es esta aplicación?

Una app web para un cine local que permite ver la cartelera del día y reservar asientos. Construida con:

- **Flask** — el framework de Python que maneja la lógica del negocio
- **SQLite** — la base de datos donde se guardan las reservas (es un archivo, no un programa separado)
- **HTML, CSS y JavaScript** — la interfaz que ve el usuario en el navegador

---

## Infraestructura utilizada

| Qué | Detalle |
|-----|---------|
| Proveedor | DigitalOcean |
| Servidor | Droplet Basic — 1 vCPU, 512 MB RAM, 10 GB disco |
| Sistema operativo | Ubuntu 24 |
| IP pública | 159.65.223.239 |
| Costo | ~$4 USD/mes |

---


## Arquitectura de producción

Así funciona el flujo de una visita a la app:

```
Navegador del usuario
        ↓
    Nginx (puerto 80)
    "El portero — recibe todas las visitas"
        ↓
  Gunicorn (puerto 8000, solo interno)
  "El servidor de producción de Python"
        ↓
    Flask — app.py
    "La lógica de la aplicación"
        ↓
    cinemas.db
    "La base de datos SQLite"
```

Todo esto corre dentro del mismo servidor de $4/mes.

---

## Las 5 capas del despliegue

Un despliegue profesional se hace por capas. Cada capa tiene una responsabilidad específica y no puede saltarse.

---

## CAPA 1 — Traer el código al servidor

### ¿Para qué sirve esta capa?
El servidor está vacío. Necesitamos traer el código desde GitHub, que es la fuente de verdad del proyecto.

### Herramienta: Git
Git es un sistema de control de versiones. Permite guardar el historial de cambios del código y descargarlo en cualquier servidor con un solo comando.

### Comandos

```bash
cd /root
git clone https://github.com/kevinhndz/HandsOn.git cinemas
cd cinemas
```

**Qué hace cada línea:**
- `cd /root` — nos movemos a la carpeta principal del usuario root en el servidor
- `git clone https://github.com/kevinhndz/HandsOn.git cinemas` — descarga todo el repositorio de GitHub y lo guarda en una carpeta llamada `cinemas`
- `cd cinemas` — entramos a esa carpeta

### Verificación
```bash
ls
```
Se deberia de ver: `app.py`, carpeta `templates`, carpeta `static`, `cinemas.db`

---

## CAPA 2 — Instalar la aplicación y su servidor de producción

### ¿Para qué sirve esta capa?
Flask trae un servidor web para desarrollo que el mismo Flask advierte "no uses en producción". **Gunicorn** es el servidor real que puede manejar múltiples usuarios al mismo tiempo.

### Herramientas

| Herramienta | Qué es | Para qué se usa |
|-------------|--------|-----------------|
| **python3-venv** | Paquete del sistema | Permite crear entornos virtuales de Python |
| **Entorno virtual (venv)** | Burbuja aislada de Python | Evita que las librerías de este proyecto choquen con otras cosas del servidor |
| **pip** | Instalador de librerías Python | Instala Flask y Gunicorn dentro del entorno virtual |
| **Gunicorn** | Servidor WSGI de producción | Reemplaza el servidor de desarrollo de Flask |

### Comandos

```bash
apt update && apt install -y python3-venv nginx
```
**Qué hace:** actualiza la lista de programas disponibles e instala `python3-venv` (necesario para crear el entorno virtual) y `nginx` (el portero, se configura en la Capa 4).

```bash
python3 -m venv venv
```
**Qué hace:** crea el entorno virtual aislado llamado `venv` dentro de la carpeta del proyecto.

```bash
source venv/bin/activate
```
**Qué hace:** entra al entorno virtual. Sabrás que funcionó porque el prompt de la terminal cambia a `(venv) root@...`

```bash
pip install flask gunicorn
```
**Qué hace:** instala Flask y Gunicorn dentro del entorno virtual.

### Prueba manual (antes de automatizar)

```bash
gunicorn --bind 0.0.0.0:8000 app:app
```
**Qué hace:** arranca la app temporalmente en el puerto 8000 para confirmar que todo funciona. Es como probar el motor antes de instalar el auto.

Abre `http://159.65.223.239:8000` en el navegador. Si ves la página del cine, funciona. Presiona `Ctrl+C` para detenerlo.

### Verificación
```bash
gunicorn --version
```

---

## CAPA 3 — Systemd: mantener la app viva siempre

### ¿Para qué sirve esta capa?
Si se corre Gunicorn manualmente y se cierra la terminal, la app se cae. **Systemd** es el administrador de procesos de Linux — es como decirle al sistema operativo "corre este programa siempre, incluso si el servidor reinicia, incluso si la app se cae sola".

### Herramienta: Systemd
Systemd viene incluido en Ubuntu. No hay que instalarlo. Se configura creando un archivo de servicio.

### Crear el archivo de servicio

```bash
cat > /etc/systemd/system/cinemas.service << 'EOF'
[Unit]
Description=Cinemas Valladolid Flask App
After=network.target

[Service]
User=root
WorkingDirectory=/root/cinemas
Environment="PATH=/root/cinemas/venv/bin"
ExecStart=/root/cinemas/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

**Qué significa cada sección:**
- `[Unit]` — nombre del servicio y cuándo arranca (después de que la red esté lista)
- `WorkingDirectory` — dónde está el proyecto
- `ExecStart` — el comando exacto para arrancar la app
- `--workers 2` — Gunicorn puede atender 2 usuarios al mismo tiempo (ideal para 512 MB de RAM)
- `--bind 127.0.0.1:8000` — Gunicorn solo escucha internamente, no desde internet. Nginx será quien reciba visitas externas
- `Restart=always` — si la app se cae, Linux la levanta sola automáticamente
- `[Install]` — en qué momento del arranque del sistema se activa

### Activar el servicio

```bash
systemctl daemon-reload
```
**Qué hace:** le dice a Linux "acabo de crear un archivo de servicio nuevo, reconócelo".

```bash
systemctl enable cinemas
```
**Qué hace:** le dice a Linux "cuando el servidor reinicie, arranca este servicio automáticamente".

```bash
systemctl start cinemas
```
**Qué hace:** arranca el servicio ahora mismo sin esperar un reinicio.

### Verificación

```bash
systemctl status cinemas
```

**Lo que se debe de ver en si:**
```
● cinemas.service - Cinemas Valladolid Flask App
     Loaded: loaded (/etc/systemd/system/cinemas.service; enabled; preset: enabled)
     Active: active (running) since Sun 2026-07-05 08:24:50 UTC; 26ms ago
   Main PID: 2041 (gunicorn)
      Tasks: 1 (limit: 503)
     Memory: 1.0M (peak: 1.1M)
        CPU: 7ms
     CGroup: /system.slice/cinemas.service
             └─2041 /root/cinemas/venv/bin/python3 /root/cinemas/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8000 app:app

Jul 05 08:24:50 gimnasio-prod systemd[1]: Started cinemas.service - Cinemas Valladolid Flask App.
```

OJO !!! La línea clave es `Active: active (running)` — si aparece en verde, esta capa está lista.

---

## CAPA 4 — Nginx: el portero del servidor

### ¿Para qué sirve esta capa?
Gunicorn no está diseñado para estar expuesto directamente a internet. **Nginx** se pone adelante, recibe todas las visitas en el puerto 80 (el puerto normal de internet), sirve los archivos CSS y JS directamente desde el disco (más rápido), y manda el resto a Gunicorn.

### Herramienta: Nginx
Nginx es un servidor web de alto rendimiento. Se usa en millones de sitios en producción. Consume solo 2-5 MB de RAM en reposo.

### Crear la configuración

```bash
cat > /etc/nginx/sites-available/cinemas << 'EOF'
server {
    listen 80;
    server_name 159.65.223.239;

    location /static/ {
        alias /root/cinemas/static/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
```

**Qué significa cada parte:**
- `listen 80` — Nginx escucha en el puerto 80, el puerto normal de internet
- `location /static/` — cuando alguien pide un archivo CSS o JS, Nginx lo sirve directo desde el disco sin pasar por Flask
- `proxy_pass http://127.0.0.1:8000` — todo lo demás lo manda a Gunicorn internamente
- `proxy_set_header` — le pasa a Flask información del visitante real como su IP

### Activar la configuración

```bash
ln -s /etc/nginx/sites-available/cinemas /etc/nginx/sites-enabled/
```
**Qué hace:** crea un acceso directo para activar la configuración.

```bash
rm /etc/nginx/sites-enabled/default
```
**Qué hace:** elimina la página de bienvenida de Nginx que ocupa el puerto 80.

```bash
nginx -t
```
**Qué hace:** verifica que la configuración no tiene errores. Debes ver `syntax is ok`.

```bash
systemctl restart nginx
```
**Qué hace:** reinicia Nginx para que aplique los cambios.


```bash
chmod 755 /root
```
**Qué hace:** da permiso de lectura a la carpeta `/root` para que Nginx pueda servir los archivos estáticos.

```bash
systemctl restart nginx
```

---

## CAPA 5 — Firewall: cerrar lo que no debe estar abierto

### ¿Para qué sirve esta capa?
Un servidor recién creado tiene todos los puertos accesibles. El firewall es la última capa de seguridad — solo dejamos pasar lo estrictamente necesario.

### Herramienta: UFW (Uncomplicated Firewall)
UFW viene incluido en Ubuntu. Es una interfaz simple para manejar las reglas del firewall de Linux.

### Comandos

```bash
ufw allow 22
```
**Qué hace:** permite el puerto 22 (SSH). **Esto se hace primero** — si no lo permites antes de activar el firewall, te encierras fuera de tu propio servidor.

```bash
ufw allow 80
```
**Qué hace:** permite el puerto 80 (HTTP) para que la gente entre a tu app.

```bash
ufw enable
```
**Qué hace:** activa el firewall. Pregunta confirmación — escribe `y` y Enter.

### Verificación
```bash
ufw status
```
Se deben de ver los puertos 22 y 80 como `ALLOW`.

---

## Resultado final

La aplicación está en producción y accesible en:

```
http://159.65.223.239
```

Solo falta configurar el dominio , hare un commit cuando lo haga!

---

## Uso diario — de mantenimiento (por si hay cambios)

### Actualizar la app cuando se cambia codigo

```bash
cd /root/cinemas
git pull
systemctl restart cinemas
```
**Qué hace:** descarga los cambios nuevos de GitHub y reinicia el servicio para que tome el código nuevo.

### Ver si la app está corriendo bien

```bash
systemctl status cinemas
```

### Ver los logs si algo falla

```bash
journalctl -u cinemas -n 50
```
**Qué hace:** muestra las últimas 50 líneas de registros del servicio. Ahí aparecen los errores si la app tiene problemas.

### Reiniciar la app manualmente

```bash
systemctl restart cinemas
```

---



## Resumen de herramientas

| Herramienta | Capa | Función |
|-------------|------|---------|
| **Git** | 1 | Trae el código desde GitHub al servidor |
| **python3-venv** | 2 | Crea el entorno virtual aislado de Python |
| **Gunicorn** | 2 | Servidor de producción para Flask |
| **Systemd** | 3 | Mantiene la app corriendo siempre automáticamente |
| **Nginx** | 4 | Portero del servidor, sirve archivos estáticos y hace proxy |
| **UFW** | 5 | Firewall, solo deja pasar lo necesario |

---

