from flask import Flask, render_template


app = Flask(__name__)


@app.route('/')
def home():
    
    
    hay = True
    contenido = {}
    
    if hay == True:
        contenido = {
        "Name": "Kevin",
        "City": "Comayagua",
        "Age": 26,
        "Message":"Bienvenido"
        
    }
    else:
        contenido = {
            "Message": "No hay Contenido en la base de datos"
        }
        hay = False
        
        
    
    
    
    return render_template('index.html',contenido= contenido, hay = hay)


@app.route('/proyects')
def proyectos():
    projectos = ["Git", "Docker"]
    
    return render_template('proyects.html',projectos = projectos)





if __name__ == "__main__":
    app.run(debug=True)