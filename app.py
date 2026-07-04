import os
import random
import sqlite3
import string
from datetime import datetime, timezone

from flask import Flask, g, jsonify, render_template, request

app = Flask(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cinemas.db")

PELICULAS = [
    {
        "id": 1, "titulo": "El último tren a Mérida", "genero": "Drama", "duracion": 118,
        "actor": "Renata Solís", "color": "#7a2f2f",
        "descripcion": "Un maquinista descubre un secreto familiar en su último recorrido por el sureste.",
        "horarios": ["14:00", "17:30", "20:15"],
    },
    {
        "id": 2, "titulo": "Guardianes del Cenote", "genero": "Aventura", "duracion": 102,
        "actor": "Emilio Duarte", "color": "#1f5c52",
        "descripcion": "Un grupo de exploradores protege un cenote sagrado de cazadores de tesoros.",
        "horarios": ["13:00", "16:00", "19:00", "21:45"],
    },
    {
        "id": 3, "titulo": "Risas en la Plaza", "genero": "Comedia", "duracion": 95,
        "actor": "Camila Reyes", "color": "#9c6a1f",
        "descripcion": "Una boda en el centro histórico se sale de control por culpa del suegro.",
        "horarios": ["15:00", "18:30"],
    },
    {
        "id": 4, "titulo": "Sombras de Chichén", "genero": "Terror", "duracion": 108,
        "actor": "Marco Iturbe", "color": "#3d2a5c",
        "descripcion": "Un equipo de restauración despierta algo que llevaba siglos dormido.",
        "horarios": ["20:00", "22:30"],
    },
]

FILAS = ["A", "B", "C", "D", "E"]
ASIENTOS_POR_FILA = 8


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS reservas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pelicula_id INTEGER NOT NULL,
            pelicula_titulo TEXT NOT NULL,
            hora TEXT NOT NULL,
            asiento TEXT NOT NULL,
            nombre TEXT NOT NULL,
            correo TEXT NOT NULL,
            folio TEXT NOT NULL,
            creado_en TEXT NOT NULL,
            UNIQUE(pelicula_id, hora, asiento)
        )
        """
    )
    db.commit()
    db.close()


def buscar_pelicula(pelicula_id):
    return next((p for p in PELICULAS if p["id"] == pelicula_id), None)


def generar_folio():
    caracteres = string.ascii_uppercase + string.digits
    return "CV-" + "".join(random.choices(caracteres, k=6))


@app.route("/")
def inicio():
    return render_template("index.html")


@app.route("/api/peliculas")
def api_peliculas():
    return jsonify(PELICULAS)


@app.route("/api/asientos")
def api_asientos():
    pelicula_id = request.args.get("pelicula_id", type=int)
    hora = request.args.get("hora", type=str)

    if pelicula_id is None or not hora:
        return jsonify({"error": "faltan parámetros pelicula_id y hora"}), 400

    db = get_db()
    ocupados_rows = db.execute(
        "SELECT asiento FROM reservas WHERE pelicula_id = ? AND hora = ?",
        (pelicula_id, hora),
    ).fetchall()
    ocupados = {fila["asiento"] for fila in ocupados_rows}

    filas = []
    for letra in FILAS:
        asientos = []
        for numero in range(1, ASIENTOS_POR_FILA + 1):
            asiento_id = f"{letra}{numero}"
            asientos.append({
                "id": asiento_id,
                "numero": numero,
                "disponible": asiento_id not in ocupados,
            })
        filas.append({"letra": letra, "asientos": asientos})

    return jsonify({"filas": filas})


@app.route("/api/reservar", methods=["POST"])
def api_reservar():
    datos = request.get_json(silent=True) or {}

    pelicula_id = datos.get("pelicula_id")
    hora = datos.get("hora")
    asientos = datos.get("asientos") or []
    nombre = (datos.get("nombre") or "").strip()
    correo = (datos.get("correo") or "").strip()

    if not pelicula_id or not hora or not asientos:
        return jsonify({"error": "faltan datos de la función o los asientos"}), 400
    if not nombre or not correo or "@" not in correo:
        return jsonify({"error": "nombre o correo inválidos"}), 400

    pelicula = buscar_pelicula(int(pelicula_id))
    if not pelicula:
        return jsonify({"error": "película no encontrada"}), 404

    db = get_db()

    ocupados_rows = db.execute(
        "SELECT asiento FROM reservas WHERE pelicula_id = ? AND hora = ?",
        (pelicula_id, hora),
    ).fetchall()
    ocupados = {fila["asiento"] for fila in ocupados_rows}
    conflicto = [a for a in asientos if a in ocupados]
    if conflicto:
        return jsonify({"error": "estos asientos ya se reservaron: " + ", ".join(conflicto)}), 409

    folio = generar_folio()
    ahora = datetime.now(timezone.utc).isoformat()

    try:
        for asiento in asientos:
            db.execute(
                """
                INSERT INTO reservas
                    (pelicula_id, pelicula_titulo, hora, asiento, nombre, correo, folio, creado_en)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (pelicula_id, pelicula["titulo"], hora, asiento, nombre, correo, folio, ahora),
            )
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify({"error": "alguien más reservó uno de estos asientos justo ahora"}), 409

    return jsonify({"folio": folio})


@app.route("/api/reservas")
def api_reservas():
    """Lista todas las reservas agrupadas por folio. Útil para revisar
    rápido desde el navegador o para un futuro panel de administración."""
    db = get_db()
    filas = db.execute(
        """
        SELECT folio, pelicula_titulo, hora, nombre, correo,
               GROUP_CONCAT(asiento) AS asientos, MIN(creado_en) AS creado_en
        FROM reservas
        GROUP BY folio
        ORDER BY creado_en DESC
        """
    ).fetchall()
    return jsonify([dict(fila) for fila in filas])


init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)