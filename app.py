from flask import Flask, render_template, request

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/atributos", methods=["POST"])
def atributos():
    kevin = {"Edad": 26, "Equipo": "Portugal", "Sexo": "M"}
    maria = {"Edad": 19, "Equipo": "Francia", "Sexo": "F"}
    oscar = {"Edad": 22, "Equipo": "Inglaterra", "Sexo": "M"}

    campo = request.form.get("campo")

    match campo:
        case "kevin":
            datos = kevin
        case "maria":
            datos = maria
        case "oscar":
            datos = oscar
        case _:
            datos = {"Error": "No encontrado"}

    return render_template(
        "atributos.html",
        nombre=campo,
        datos=datos
    )

if __name__ == "__main__":
    app.run(debug=True)