from flask import Flask, render_template,request

app = Flask(__name__)

@app.route ('/')
def main():
    return render_template('index.html')


@app.route('/cualidades', methods = ["POST"])
def atributos():
    
    name = request.form.get("nombre")
    posicion_jugador = request.form.get("campo")
    es_capitan = request.form.get("capitan")
    
    if es_capitan == None:
        es_capitan = "Jugador de Campo"
    else:
        es_capitan = "Es Capitan"
    
    diccionario = {
        
        "Nombre": name,
        "Posicion": posicion_jugador,
        "Capitan": es_capitan
    }
    
    
    nombre= diccionario["Nombre"]
    return render_template('atributos.html',diccionario = diccionario, nombre = nombre)
    
    
    
if __name__ == "__main__":
    app.run(debug=True)