from flask import Flask, render_template, request, redirect, url_for, session, flash, request, send_file
import requests
import json
import base64
import pyrebase  # IMPORTANTE: Reemplaza a sqlite3
import requests 
import io
import requests


app = Flask(__name__)
app.secret_key = "clave_secreta"

# ==========================================================
# CONFIGURACIÓN DE FIREBASE (Reemplaza a la base de datos local)
# ==========================================================
firebase_config = {
    "apiKey": "AIzaSyBpwRtDft9k2CTnmBsSPWR-vjD4gPbDH3I",
    "authDomain": "george-gilberth.firebaseapp.com",
    "databaseURL": "https://george-gilberth-default-rtdb.firebaseio.com",
    "projectId": "george-gilberth",
    "storageBucket": "george-gilberth.firebasestorage.app",
    "messagingSenderId": "444338536878",
    "appId": "1:444338536878:web:1844ac822f9a085b10083f",
    "measurementId": "G-4XFBVVC0R7"
}

firebase = pyrebase.initialize_app(firebase_config)
auth = firebase.auth()
db = firebase.database()

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
# REGISTRO Y AUTENTICACIÓN (CONECTADO A FIREBASE)
# ==========================================================

@app.route("/registro")
def registro():
    return render_template("registro.html", nombre_agente=NOMBRE_AGENTE)

@app.route("/registro-docente")
def registro_docente():
    return render_template("registro_docente.html", nombre_agente=NOMBRE_AGENTE)

@app.route("/registro-orientador")
def registro_orientador():
    return render_template("registro_orientador.html", nombre_agente=NOMBRE_AGENTE)


@app.route("/crear-estudiante", methods=["POST"])
def crear_estudiante():
    nombre = request.form["nombre"]
    apellido1 = request.form["apellido1"]
    apellido2 = request.form["apellido2"]
    correo = request.form["correo"]
    password = request.form["password"]

    try:
        # 1. Creamos la cuenta en Firebase Auth
        user = auth.create_user_with_email_and_password(correo, password)
        user_id = user['localId'] # ID único del usuario

        # 2. Guardamos sus datos personales en Firebase Database
        datos_usuario = {
            "nombre": nombre,
            "apellido1": apellido1,
            "apellido2": apellido2,
            "correo": correo,
            "tipo": "estudiante"
        }
        db.child("usuarios").child(user_id).set(datos_usuario)

        session["usuario"] = correo
        session["tipo"] = "estudiante"
        flash("Cuenta creada correctamente ✅")
        return redirect("/inicio")

    except Exception as e:
        return render_template("registro.html", error="El correo ya está registrado o la contraseña es muy débil (mínimo 6 caracteres) ❌", nombre_agente=NOMBRE_AGENTE)


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
        user = auth.create_user_with_email_and_password(correo, password)
        user_id = user['localId']

        datos_usuario = {
            "nombre": nombre,
            "apellido1": apellido1,
            "apellido2": apellido2,
            "correo": correo,
            "institucion": institucion,
            "materia": materia,
            "tipo": "docente"
        }
        db.child("usuarios").child(user_id).set(datos_usuario)

        session["usuario"] = correo
        session["tipo"] = "docente"
        flash("Cuenta de docente creada correctamente ✅")
        return redirect("/inicio")

    except Exception as e:
        return render_template("registro_docente.html", error="Correo ya registrado o contraseña débil ❌", nombre_agente=NOMBRE_AGENTE)


@app.route("/crear-orientador", methods=["POST"])
def crear_orientador():
    nombre = request.form["nombre"]
    apellido1 = request.form["apellido1"]
    apellido2 = request.form["apellido2"]
    correo = request.form["correo"]
    password = request.form["password"]

    try:
        user = auth.create_user_with_email_and_password(correo, password)
        user_id = user['localId']

        datos_usuario = {
            "nombre": nombre,
            "apellido1": apellido1,
            "apellido2": apellido2,
            "correo": correo,
            "tipo": "orientador"
        }
        db.child("usuarios").child(user_id).set(datos_usuario)

        session["usuario"] = correo
        session["tipo"] = "orientador"
        flash("Cuenta de orientador creada correctamente ✅")
        return redirect("/inicio")

    except Exception as e:
        return render_template("registro_orientador.html", error="Correo ya registrado ❌", nombre_agente=NOMBRE_AGENTE)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        correo = request.form["correo"]
        password = request.form["password"]

        try:
            # 1. Verificamos credenciales en Firebase Auth
            user = auth.sign_in_with_email_and_password(correo, password)
            user_id = user['localId']

            # 2. Buscamos el rol ("tipo") del usuario en Firebase Database
            datos_perfil = db.child("usuarios").child(user_id).get().val()

            if datos_perfil:
                session["usuario"] = correo
                session["tipo"] = datos_perfil.get("tipo", "estudiante")
                flash("Credenciales correctas ✅")
                return redirect("/inicio")
            else:
                return render_template("login.html", error="Error: Perfil incompleto en la base de datos.")

        except Exception as e:
            # Firebase rechaza el inicio de sesión si el correo o la clave están mal
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
    return render_template("generador.html", nombre_agente=NOMBRE_AGENTE)

@app.route("/crear-material", methods=["POST"])
def crear_material():
   

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




@app.route('/recuperar_contrasena', methods=['GET', 'POST'])
def recuperar_contrasena():

    if request.method == 'POST':

        correo = request.form.get('correo')
        contrasena_actual = request.form.get('contrasena_actual')
        nueva_contrasena = request.form.get('nueva_contrasena')
        confirmar_contrasena = request.form.get('confirmar_contrasena')

        # Verificar que las nuevas contraseñas coincidan
        if nueva_contrasena != confirmar_contrasena:
            return render_template(
                'recuperar_contrasena.html',
                error='Las nuevas contraseñas no coinciden ❌'
            )

        try:

            # 1. Verificar correo y contraseña actual con Firebase
            url_login = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={firebase_config['apiKey']}"

            respuesta_login = requests.post(
                url_login,
                json={
                    "email": correo,
                    "password": contrasena_actual,
                    "returnSecureToken": True
                }
            )

            # Si la contraseña actual es incorrecta
            if respuesta_login.status_code != 200:
                print("ERROR AL VERIFICAR CONTRASEÑA:", respuesta_login.text)

                return render_template(
                    'recuperar_contrasena.html',
                    error='El correo o la contraseña actual no son correctos ❌'
                )

            # 2. Obtener el token de Firebase
            datos_usuario = respuesta_login.json()
            id_token = datos_usuario['idToken']

            # 3. Actualizar la contraseña
            url_actualizar = f"https://identitytoolkit.googleapis.com/v1/accounts:update?key={firebase_config['apiKey']}"

            respuesta_actualizar = requests.post(
                url_actualizar,
                json={
                    "idToken": id_token,
                    "password": nueva_contrasena,
                    "returnSecureToken": True
                }
            )

            # 4. Comprobar que Firebase actualizó correctamente
            if respuesta_actualizar.status_code != 200:

                print(
                    "ERROR FIREBASE AL ACTUALIZAR:",
                    respuesta_actualizar.text
                )

                return render_template(
                    'recuperar_contrasena.html',
                    error='No se pudo actualizar la contraseña ❌'
                )

            # 5. Contraseña actualizada
            flash("Contraseña actualizada correctamente ✅")

            return redirect('/login')

        except Exception as e:

            print("ERROR AL CAMBIAR CONTRASEÑA:", e)

            return render_template(
                'recuperar_contrasena.html',
                error='Ocurrió un error al cambiar la contraseña ❌'
            )

    return render_template('recuperar_contrasena.html')



@app.route('/olvidar_contrasena', methods=['GET', 'POST'])
def olvidar_contrasena():

    if request.method == 'POST':

        correo = request.form.get('correo')

        print("================================")
        print("SOLICITUD DE RECUPERACIÓN")
        print("CORREO:", correo)

        try:

            resultado = auth.send_password_reset_email(correo)

            print("FIREBASE RESPONDIÓ CORRECTAMENTE")
            print("RESULTADO:", resultado)

            flash("Correo de recuperación enviado. Revisa tu correo 📧")

            return redirect('/login')

        except Exception as e:

            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            print("ERROR DE FIREBASE")
            print("ERROR:", e)
            print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")

            return render_template(
                'olvidar_contrasena.html',
                error="No se pudo enviar el correo de recuperación."
            )

    return render_template('olvidar_contrasena.html')
