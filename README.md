# 🎬 Cinemas Valladolid — Guía de Despliegue en Producción

Esta guía documenta paso a paso cómo desplegar la aplicación **Cinemas Valladolid** en un servidor real de DigitalOcean con 512 MB de RAM. Está escrita para que cualquier persona, sin experiencia previa en servidores, pueda entenderla y repetirla.

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




## Arquitectura de producción

El flujo de una visita a la aplicación es el siguiente:

```
Navegador del usuario
        ↓
    Nginx (puerto 80)
    "Recibe todas las visitas desde internet"
        ↓
  Gunicorn (puerto 8000, solo interno)
  "Servidor de producción de Python"
        ↓
    Flask — app.py
    "Lógica de la aplicación"
        ↓
    cinemas.db
    "Base de datos SQLite"
```

Todo esto corre dentro del mismo servidor de $4/mes.

---

## Las 5 capas del despliegue

Un despliegue profesional se organiza en capas. Cada capa tiene una responsabilidad específica y deben ejecutarse en orden.

---

## CAPA 1 — Traer el código al servidor

### ¿Para qué sirve esta capa?
El servidor está vacío. El código se descarga desde GitHub, que actúa como la fuente de verdad del proyecto.

### Herramienta: Git
Sistema de control de versiones. Permite guardar el historial de cambios del código y descargarlo en cualquier servidor con un solo comando.

### Comandos

```bash
cd /root
git clone https://github.com/kevinhndz/HandsOn.git cinemas
cd cinemas
```

**Qué hace cada línea:**
- `cd /root` — accede a la carpeta principal del usuario root en el servidor
- `git clone ... cinemas` — descarga el repositorio de GitHub y lo guarda en una carpeta llamada `cinemas`
- `cd cinemas` — entra a esa carpeta

### Verificación
```bash
ls
```
Se debe ver: `app.py`, carpeta `templates`, carpeta `static`, `cinemas.db`

---

## CAPA 2 — Instalar la aplicación y su servidor de producción

### ¿Para qué sirve esta capa?
Flask incluye un servidor web pensado solo para desarrollo. **Gunicorn** es el servidor real, diseñado para producción, capaz de manejar múltiples usuarios al mismo tiempo.

### Herramientas

| Herramienta | Qué es | Para qué se usa |
|-------------|--------|-----------------|
| **python3-venv** | Paquete del sistema | Permite crear entornos virtuales de Python |
| **Entorno virtual (venv)** | Burbuja aislada de Python | Evita que las librerías del proyecto choquen con otras del servidor |
| **pip** | Instalador de librerías Python | Instala Flask y Gunicorn dentro del entorno virtual |
| **Gunicorn** | Servidor WSGI de producción | Reemplaza el servidor de desarrollo de Flask |

### Comandos

```bash
apt update && apt install -y python3-venv nginx
```
**Qué hace:** actualiza la lista de programas disponibles e instala `python3-venv` y `nginx`.

```bash
python3 -m venv venv
```
**Qué hace:** crea un entorno virtual aislado llamado `venv` dentro de la carpeta del proyecto.

```bash
source venv/bin/activate
```
**Qué hace:** activa el entorno virtual. El prompt de la terminal cambiará a `(venv) root@...` como confirmación.

```bash
pip install flask gunicorn
```
**Qué hace:** instala Flask y Gunicorn dentro del entorno virtual.

### Prueba manual antes de automatizar

```bash
gunicorn --bind 0.0.0.0:8000 app:app
```
**Qué hace:** arranca la app temporalmente en el puerto 8000 para confirmar que funciona antes de configurar el servicio permanente.

Abrir `http://IP_DEL_SERVIDOR:8000` en el navegador. Si la página carga correctamente, presionar `Ctrl+C` para detenerla y continuar.

### Verificación
```bash
gunicorn --version
```

---

## CAPA 3 — Systemd: mantener la app activa siempre

### ¿Para qué sirve esta capa?
Si Gunicorn se corre manualmente y se cierra la terminal, la app se detiene. **Systemd** es el administrador de procesos de Linux. Se encarga de mantener la app corriendo siempre, incluso si el servidor reinicia o si la app falla.

### Herramienta: Systemd
Viene incluido en Ubuntu. No requiere instalación. Se configura creando un archivo de servicio.

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
- `WorkingDirectory` — ruta donde está el proyecto
- `ExecStart` — comando exacto para arrancar la app
- `--workers 2` — Gunicorn atiende 2 usuarios simultáneamente (recomendado para 512 MB de RAM)
- `--bind 127.0.0.1:8000` — Gunicorn solo escucha internamente; Nginx es quien recibe las visitas externas
- `Restart=always` — si la app falla, Linux la reinicia automáticamente
- `[Install]` — define en qué momento del arranque del sistema se activa el servicio

### Activar el servicio

```bash
systemctl daemon-reload
```
**Qué hace:** le indica a Linux que reconozca el nuevo archivo de servicio creado.

```bash
systemctl enable cinemas
```
**Qué hace:** configura el servicio para que arranque automáticamente cuando el servidor reinicie.

```bash
systemctl start cinemas
```
**Qué hace:** arranca el servicio en ese momento sin esperar un reinicio.

### Verificación

```bash
systemctl status cinemas
```

**Salida esperada:**
```
● cinemas.service - Cinemas Valladolid Flask App
     Loaded: loaded (/etc/systemd/system/cinemas.service; enabled; preset: enabled)
     Active: active (running) since Sun 2026-07-05 08:24:50 UTC; 26ms ago
   Main PID: 2041 (gunicorn)
      Tasks: 1 (limit: 503)
     Memory: 1.0M (peak: 1.1M)
        CPU: 7ms
     CGroup: /system.slice/cinemas.service
             └─2041 /root/cinemas/venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8000 app:app

Jul 05 08:24:50 gimnasio-prod systemd[1]: Started cinemas.service - Cinemas Valladolid Flask App.
```

> ⚠️ La línea clave es `Active: active (running)`. Si aparece en verde, esta capa está completa.

---

## CAPA 4 — Nginx: proxy inverso y servidor de archivos estáticos

### ¿Para qué sirve esta capa?
Gunicorn no está diseñado para recibir tráfico directo de internet. **Nginx** actúa como intermediario: recibe todas las visitas en el puerto 80, sirve los archivos CSS y JS directamente desde el disco, y redirige el resto del tráfico a Gunicorn.

### Herramienta: Nginx
Servidor web de alto rendimiento. Ampliamente utilizado en producción a nivel mundial. Consume entre 2 y 5 MB de RAM en reposo.

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
- `listen 80` — Nginx escucha en el puerto 80, el puerto estándar de internet
- `location /static/` — los archivos CSS y JS se sirven directamente desde el disco, sin pasar por Flask
- `proxy_pass http://127.0.0.1:8000` — el resto del tráfico se redirige a Gunicorn internamente
- `proxy_set_header` — transmite a Flask información del visitante, como su IP real

### Activar la configuración

```bash
ln -s /etc/nginx/sites-available/cinemas /etc/nginx/sites-enabled/
```
**Qué hace:** crea un enlace simbólico para activar la configuración.

```bash
rm /etc/nginx/sites-enabled/default
```
**Qué hace:** elimina la página de bienvenida de Nginx que ocupa el puerto 80.

```bash
nginx -t
```
**Qué hace:** verifica que la configuración no tiene errores de sintaxis. Se debe ver `syntax is ok`.

```bash
systemctl restart nginx
```
**Qué hace:** reinicia Nginx para aplicar los cambios.

### Problema conocido — permisos en /root

Nginx no puede leer archivos ubicados dentro de `/root` por restricciones de permisos de Linux. Se resuelve con:

```bash
chmod 755 /root
systemctl restart nginx
```

**Qué hace `chmod 755 /root`:** otorga permiso de lectura a la carpeta `/root` para que Nginx pueda servir los archivos estáticos.

---

## CAPA 5 — Firewall: cerrar lo que no debe estar abierto

### ¿Para qué sirve esta capa?
Un servidor recién creado tiene todos sus puertos accesibles desde internet. El firewall restringe el acceso y solo permite el tráfico necesario.

### Herramienta: UFW (Uncomplicated Firewall)
Viene incluido en Ubuntu. Proporciona una interfaz simple para gestionar las reglas del firewall de Linux.

### Comandos

```bash
ufw allow 22
```
**Qué hace:** permite el puerto 22 (SSH). Debe ejecutarse **antes** de activar el firewall; de lo contrario, se pierde el acceso al servidor.

```bash
ufw allow 80
```
**Qué hace:** permite el puerto 80 (HTTP) para que los usuarios accedan a la app.

```bash
ufw enable
```
**Qué hace:** activa el firewall. Solicita confirmación — escribir `y` y presionar Enter.

### Verificación
```bash
ufw status
```
Los puertos 22 y 80 deben aparecer como `ALLOW`.

---

## Resultado final

La aplicación queda disponible públicamente en:

```
http://159.65.223.239
```

> Pendiente: configurar dominio personalizado y HTTPS con Certbot.

---

## Mantenimiento — operaciones del día a día

### Actualizar la app después de un cambio de código

```bash
cd /root/cinemas
git pull
systemctl restart cinemas
```
**Qué hace:** descarga los cambios desde GitHub y reinicia el servicio para que tome el código actualizado.

### Verificar que la app está corriendo

```bash
systemctl status cinemas
```

### Ver los logs del servicio

```bash
journalctl -u cinemas -n 50
```
**Qué hace:** muestra las últimas 50 líneas de registros del servicio. Los errores de la app aparecen aquí.

### Reiniciar la app manualmente

```bash
systemctl restart cinemas
```

---

## Resumen de herramientas

| Herramienta | Capa | Función |
|-------------|------|---------|
| **Git** | 1 | Descarga el código desde GitHub al servidor |
| **python3-venv** | 2 | Crea el entorno virtual aislado de Python |
| **Gunicorn** | 2 | Servidor de producción para Flask |
| **Systemd** | 3 | Mantiene la app corriendo siempre de forma automática |
| **Nginx** | 4 | Recibe visitas, sirve archivos estáticos y actúa como proxy |
| **UFW** | 5 | Firewall — solo permite el tráfico necesario |

---

*