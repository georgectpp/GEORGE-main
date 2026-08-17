from flask import Flask, render_template, request, redirect, url_for, session, flash
import requests
import json
import sqlite3
import base64

app = Flask(__name__)
app.secret_key = "clave_secreta"
def iniciar_base_datos():
    with sqlite3.connect("george.db") as conexion:
        cursor = conexion.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                apellido1 TEXT NOT NULL,
                apellido2 TEXT,
                correo TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                tipo TEXT NOT NULL,
                institucion TEXT,
                materia TEXT
            )
        """)
        conexion.commit()

# Ejecutamos la función apenas arranca el servidor
iniciar_base_datos()

NOMBRE_AGENTE = "GEORGE"

# ==========================================================
# CONFIGURACIÓN WEBHOOK N8N
# ==========================================================
WEBHOOK_N8N = "https://innowgrp09.app.n8n.cloud/webhook/george-material"
MODO_PRUEBA = False

# ==========================================================
# RUTAS PRINCIPALES Y DE NAVEGACIÓN
# ==========================================================

@app.route("/")
def index():
    """Página de bienvenida pública (index2.html de tu compañero)."""
    return render_template("index2.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/foro")
def foro():
    """Tu Foro Estudiantil (index.html)."""
    if "usuario" not in session or session.get("tipo") != "estudiante":
        return redirect("/login")
    return render_template("index.html", nombre_agente=NOMBRE_AGENTE, usuario_activo=session["usuario"])


@app.route("/orientadores")
def orientadores_panel():
    """Panel de Orientación privado."""
    if "usuario" not in session or session.get("tipo") != "orientador":
        return redirect("/login")
    return render_template("orientadores.html", nombre_agente=NOMBRE_AGENTE, usuario_activo=session["usuario"])


# ==========================================================
# REGISTRO Y AUTENTICACIÓN
# ==========================================================

@app.route("/registro")
def registro():
    """Pantalla de registro de estudiantes."""
    return render_template("registro.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/registro-docente")
def registro_docente():
    """Pantalla de registro de docentes."""
    return render_template("registro_docente.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/registro-orientador")
def registro_orientador():
    """Pantalla de registro para orientadores."""
    return render_template("registro_orientador.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/crear-estudiante", methods=["POST"])
def crear_estudiante():
    nombre = request.form["nombre"]
    apellido1 = request.form["apellido1"]
    apellido2 = request.form["apellido2"]
    correo = request.form["correo"]
    password = request.form["password"]

    try:
        with sqlite3.connect("george.db") as conexion:
            cursor = conexion.cursor()
            cursor.execute("""
                INSERT INTO usuarios
                (nombre, apellido1, apellido2, correo, password, tipo)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (nombre, apellido1, apellido2, correo, password, "estudiante"))
            conexion.commit()

        session["usuario"] = correo
        session["tipo"] = "estudiante"
        flash("Cuenta creada correctamente ✅")
        return redirect("/inicio")

    except sqlite3.IntegrityError:
        return render_template("registro.html", error="Correo ya registrado ❌", nombre_agente=NOMBRE_AGENTE)


@app.route("/crear-docente", methods=["POST"])
def crear_docente():
    nombre = request.form["nombre"]
    apellido1 = request.form["apellido1"]
    apellido2 = request.form["apellido2"]
    correo = request.form["correo"]
    institucion = request.form["institucion"]
    materia = request.form["materia"]
    password = request.form["password"]

    try:
        with sqlite3.connect("george.db") as conexion:
            cursor = conexion.cursor()
            cursor.execute("""
                INSERT INTO usuarios (nombre, apellido1, apellido2, correo, institucion, materia, password, tipo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (nombre, apellido1, apellido2, correo, institucion, materia, password, "docente"))
            conexion.commit()

        session["usuario"] = correo
        session["tipo"] = "docente"
        flash("Cuenta creada correctamente ✅")
        return redirect("/inicio")

    except sqlite3.IntegrityError:
        return render_template("registro_docente.html", error="Correo ya registrado ❌", nombre_agente=NOMBRE_AGENTE)


@app.route("/crear-orientador", methods=["POST"])
def crear_orientador():
    nombre = request.form["nombre"]
    apellido1 = request.form["apellido1"]
    apellido2 = request.form["apellido2"]
    correo = request.form["correo"]
    password = request.form["password"]

    try:
        with sqlite3.connect("george.db") as conexion:
            cursor = conexion.cursor()
            # Aseguramos que la tabla soporte orientadores o usa la misma estructura
            cursor.execute("""
                INSERT INTO usuarios (nombre, apellido1, apellido2, correo, password, tipo)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (nombre, apellido1, apellido2, correo, password, "orientador"))
            conexion.commit()

        session["usuario"] = correo
        session["tipo"] = "orientador"
        flash("Cuenta de orientador creada correctamente ✅")
        return redirect("/inicio")

    except sqlite3.IntegrityError:
        return render_template("registro_orientador.html", error="Correo ya registrado ❌", nombre_agente=NOMBRE_AGENTE)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        correo = request.form["correo"]
        password = request.form["password"]

        with sqlite3.connect("george.db") as conexion:
            cursor = conexion.cursor()
            cursor.execute("SELECT * FROM usuarios WHERE correo = ?", (correo,))
            usuario = cursor.fetchone()

        # Verificamos contraseña (índice 5) y extraemos el tipo (índice 6)
        if usuario and usuario[5] == password:
            session["usuario"] = usuario[4]
            session["tipo"] = usuario[6]

            flash("Credenciales correctas ✅")
            return redirect("/inicio")

        return render_template("login.html", error="Credenciales incorrectas ❌")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect("/")


@app.route("/inicio")
def inicio():
    """EL SEMÁFORO: Redirige al usuario según el rol almacenado en su sesión."""
    if "usuario" not in session:
        return redirect("/login")

    tipo_usuario = session.get("tipo")

    if tipo_usuario == "docente":
        return redirect("/generador")
    elif tipo_usuario == "orientador":
        return redirect("/orientadores")
    else:
        return redirect("/foro")


# ==========================================================
# MÓDULOS DE DOCENTES Y N8N
# ==========================================================

@app.route("/generador")
def generador():
    if "usuario" not in session or session["tipo"] != "docente":
        return redirect("/login")
    return render_template("generador.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/crear-material", methods=["POST"])
def crear_material():
    if "usuario" not in session or session["tipo"] != "docente":
        return redirect("/login")

    grado = request.form.get("grado")
    materia = request.form.get("materia")
    tema = request.form.get("tema")
    enfoque = request.form.get("enfoque")
    tipo = request.form.get("tipo")
    dificultad = request.form.get("dificultad")
    tiempo = request.form.get("tiempo")
    objetivo = request.form.get("objetivo")

    datos = {
        "grado": grado, "materia": materia, "tema": tema,
        "enfoque": enfoque, "tipo": tipo, "dificultad": dificultad,
        "tiempo": tiempo, "objetivo": objetivo
    }

    if MODO_PRUEBA:
        respuesta_ia = f"GEORGE HA RECIBIDO LA INFORMACIÓN\nGrado: {grado}\nMateria: {materia}"
    else:
        try:
            respuesta = requests.post(WEBHOOK_N8N, json=datos, timeout=120)
            respuesta.raise_for_status()
            pdf_bytes = respuesta.content
            pdf_base64 = base64.b64encode(pdf_bytes).decode("utf-8")
            respuesta_ia = "data:application/pdf;base64," + pdf_base64
        except Exception as error:
            respuesta_ia = f"Error de conexión:\n\n{error}"

    return render_template("generador.html", nombre_agente=NOMBRE_AGENTE, respuesta=respuesta_ia)


@app.route("/n8n")
def panel_n8n():
    return render_template("n8n.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/claude")
def panel_claude():
    return render_template("claude.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/historial")
def historial():
    return render_template("historial.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/perfil")
def perfil():
    return render_template("perfil.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/configuracion")
def configuracion():
    return render_template("configuracion.html", nombre_agente=NOMBRE_AGENTE)


if __name__ == "__main__":
    app.run(debug=True)