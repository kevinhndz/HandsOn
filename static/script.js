(function(){
  document.querySelectorAll('[data-nav-cartelera]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.preventDefault();
      document.getElementById('cartelera').scrollIntoView({behavior:'smooth'});
    });
  });
  document.querySelector('[data-nav-home]').addEventListener('click', function(e){
    e.preventDefault();
    document.getElementById('home').scrollIntoView({behavior:'smooth'});
  });

  var state = { screen: "loading", movies: [], movie: null, time: null, selected: [], filas: [] };

  function esc(str){
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render(){
    var root = document.getElementById('cv-root');

    if (state.screen === "loading"){
      root.innerHTML = '<p style="text-align:center;color:var(--muted)">cargando cartelera...</p>';
      return;
    }

    if (state.screen === "error"){
      root.innerHTML = '<p style="text-align:center;color:var(--danger)">' + esc(state.errorMsg || 'ocurrió un error') + '</p>';
      return;
    }

    if (state.screen === "list"){
      root.innerHTML =
        '<div class="movie-grid">' +
        state.movies.map(function(m){
          return '<div class="movie-card" data-movie="' + m.id + '">' +
            '<div class="poster" style="background:' + m.color + '"><div class="reel"></div></div>' +
            '<div class="movie-info">' +
              '<h3>' + esc(m.titulo) + '</h3>' +
              '<div class="meta">' + esc(m.genero) + ' · ' + m.duracion + ' min</div>' +
              '<span class="badge">' + m.horarios.length + ' horarios hoy</span>' +
            '</div>' +
          '</div>';
        }).join('') +
        '</div>';
      root.querySelectorAll('[data-movie]').forEach(function(el){
        el.addEventListener('click', function(){
          var id = parseInt(el.getAttribute('data-movie'), 10);
          state.movie = state.movies.filter(function(m){ return m.id === id; })[0];
          state.time = null;
          state.screen = "detail";
          render();
        });
      });
      return;
    }

    if (state.screen === "detail"){
      var m = state.movie;
      root.innerHTML =
        '<button class="back-link" data-back>&larr; cartelera</button>' +
        '<div class="panel">' +
          '<div class="detail-top">' +
            '<div class="detail-poster" style="background:' + m.color + '"><div class="reel"></div></div>' +
            '<div class="detail-info">' +
              '<h3>' + esc(m.titulo) + '</h3>' +
              '<div class="meta-row"><span>' + esc(m.genero) + '</span><span>' + m.duracion + ' min</span><span>' + esc(m.actor) + '</span></div>' +
              '<p class="desc">' + esc(m.descripcion) + '</p>' +
            '</div>' +
          '</div>' +
          '<button class="full-btn btn-gold" data-showtimes>ver horarios de hoy</button>' +
          '<div id="cv-times" style="display:none;margin-top:1rem"></div>' +
        '</div>';

      root.querySelector('[data-back]').addEventListener('click', function(){ state.screen = "list"; render(); });

      root.querySelector('[data-showtimes]').addEventListener('click', function(){
        var box = document.getElementById('cv-times');
        box.style.display = 'block';
        box.innerHTML =
          '<div class="chips">' +
          m.horarios.map(function(t){ return '<button class="chip" data-time="' + t + '">' + t + '</button>'; }).join('') +
          '</div>' +
          '<button class="full-btn btn-gold" data-reserve style="display:none">quiero reservar mi asiento</button>';

        box.querySelectorAll('[data-time]').forEach(function(btn){
          btn.addEventListener('click', function(){
            state.time = btn.getAttribute('data-time');
            box.querySelectorAll('[data-time]').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            box.querySelector('[data-reserve]').style.display = 'block';
          });
        });

        box.querySelector('[data-reserve]').addEventListener('click', function(){
          state.selected = [];
          state.screen = "seats-loading";
          render();
          cargarAsientos();
        });
      });
      return;
    }

    if (state.screen === "seats-loading"){
      root.innerHTML = '<p style="text-align:center;color:var(--muted)">cargando asientos...</p>';
      return;
    }

    if (state.screen === "seats"){
      var m2 = state.movie;
      var html = '<button class="back-link" data-back>&larr; ' + esc(m2.titulo) + '</button>' +
        '<div class="panel">' +
          '<p style="color:var(--muted);font-size:0.85rem;margin-bottom:0.3rem">función de las ' + state.time + '</p>' +
          '<h3 style="font-family:\'Work Sans\';font-weight:600;font-size:1.2rem;margin-bottom:1.25rem">elige tus asientos</h3>' +
          '<div class="screen-indicator">pantalla</div>' +
          '<div class="screen-bar"></div>';

      state.filas.forEach(function(fila){
        html += '<div class="seat-row"><span class="row-label">' + fila.letra + '</span>';
        fila.asientos.forEach(function(asiento){
          html += '<button class="seat" data-seat="' + asiento.id + '" ' + (asiento.disponible ? '' : 'disabled') + '>' + asiento.numero + '</button>';
        });
        html += '</div>';
      });

      html +=
        '<div class="legend">' +
          '<span><span class="dot"></span>libre</span>' +
          '<span><span class="dot sel"></span>seleccionado</span>' +
          '<span><span class="dot taken"></span>ocupado</span>' +
        '</div>' +
        '<p class="seat-count" id="cv-count">0 asientos seleccionados</p>' +
        '<button class="full-btn btn-gold" data-continue disabled>continuar con la reserva</button>' +
        '</div>';

      root.innerHTML = html;
      root.querySelector('[data-back]').addEventListener('click', function(){ state.screen = "detail"; render(); });

      var countEl = root.querySelector('#cv-count');
      var contBtn = root.querySelector('[data-continue]');

      root.querySelectorAll('[data-seat]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var id = btn.getAttribute('data-seat');
          if (state.selected.indexOf(id) === -1){
            state.selected.push(id);
            btn.classList.add('selected');
          } else {
            state.selected = state.selected.filter(function(s){ return s !== id; });
            btn.classList.remove('selected');
          }
          countEl.textContent = state.selected.length + ' asiento' + (state.selected.length === 1 ? '' : 's') + ' seleccionado' + (state.selected.length === 1 ? '' : 's');
          contBtn.disabled = state.selected.length === 0;
        });
      });

      contBtn.addEventListener('click', function(){
        if (state.selected.length === 0) return;
        state.screen = "form";
        render();
      });
      return;
    }

    if (state.screen === "form"){
      root.innerHTML =
        '<button class="back-link" data-back>&larr; asientos</button>' +
        '<div class="panel">' +
          '<h3 style="font-family:\'Work Sans\';font-weight:600;font-size:1.2rem;margin-bottom:0.3rem">' + esc(state.movie.titulo) + '</h3>' +
          '<p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem">' + state.time + ' · asientos ' + state.selected.join(', ') + '</p>' +
          '<input class="field" id="cv-name" type="text" placeholder="nombre completo">' +
          '<input class="field" id="cv-email" type="email" placeholder="correo electrónico">' +
          '<p id="cv-form-error" style="color:var(--danger);font-size:0.85rem;margin-bottom:0.75rem;display:none"></p>' +
          '<button class="full-btn btn-gold" data-confirm>confirmar reserva</button>' +
        '</div>';

      root.querySelector('[data-back]').addEventListener('click', function(){ state.screen = "seats"; render(); });

      root.querySelector('[data-confirm]').addEventListener('click', function(){
        var nameEl = document.getElementById('cv-name');
        var emailEl = document.getElementById('cv-email');
        var errorEl = document.getElementById('cv-form-error');
        var name = nameEl.value.trim();
        var email = emailEl.value.trim();
        nameEl.classList.remove('error');
        emailEl.classList.remove('error');
        errorEl.style.display = 'none';

        var valido = true;
        if (!name){ nameEl.classList.add('error'); valido = false; }
        if (!email || email.indexOf('@') === -1){ emailEl.classList.add('error'); valido = false; }
        if (!valido) return;

        confirmarReserva(name, email, errorEl);
      });
      return;
    }

    if (state.screen === "confirm"){
      root.innerHTML =
        '<div class="panel confirm-box">' +
          '<div class="confirm-icon">&#10003;</div>' +
          '<h3 style="font-family:\'Work Sans\';font-weight:600;font-size:1.2rem;margin-bottom:0.4rem">reserva creada</h3>' +
          '<p style="color:var(--muted);font-size:0.88rem;margin-bottom:1.25rem">' + esc(state.movie.titulo) + ' · ' + state.time + ' · ' + state.selected.join(', ') + '</p>' +
          '<div class="folio">' +
            '<div class="label">folio de confirmación</div>' +
            '<div class="id">' + state.folio + '</div>' +
          '</div>' +
          '<p style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem">presenta este folio en taquilla para pagar y recoger tus boletos.</p>' +
          '<button class="full-btn btn-outline" data-new>volver a la cartelera</button>' +
        '</div>';

      root.querySelector('[data-new]').addEventListener('click', function(){
        state = { screen: "list", movies: state.movies, movie: null, time: null, selected: [], filas: [] };
        render();
        document.getElementById('cartelera').scrollIntoView({behavior:'smooth'});
      });
      return;
    }
  }

  function cargarPeliculas(){
    state.screen = "loading";
    render();
    fetch('/api/peliculas')
      .then(function(resp){ return resp.json(); })
      .then(function(data){
        state.movies = data;
        state.screen = "list";
        render();
      })
      .catch(function(){
        state.screen = "error";
        state.errorMsg = "no se pudo cargar la cartelera.";
        render();
      });
  }

  function cargarAsientos(){
    var url = '/api/asientos?pelicula_id=' + state.movie.id + '&hora=' + encodeURIComponent(state.time);
    fetch(url)
      .then(function(resp){ return resp.json(); })
      .then(function(data){
        state.filas = data.filas;
        state.screen = "seats";
        render();
      })
      .catch(function(){
        state.screen = "error";
        state.errorMsg = "no se pudieron cargar los asientos.";
        render();
      });
  }

  function confirmarReserva(nombre, correo, errorEl){
    fetch('/api/reservar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pelicula_id: state.movie.id,
        hora: state.time,
        asientos: state.selected,
        nombre: nombre,
        correo: correo
      })
    })
      .then(function(resp){
        return resp.json().then(function(data){ return { ok: resp.ok, data: data }; });
      })
      .then(function(result){
        if (!result.ok){
          errorEl.textContent = result.data.error || 'no se pudo completar la reserva.';
          errorEl.style.display = 'block';
          return;
        }
        state.folio = result.data.folio;
        state.screen = "confirm";
        render();
      })
      .catch(function(){
        errorEl.textContent = 'error de conexión, intenta de nuevo.';
        errorEl.style.display = 'block';
      });
  }

  cargarPeliculas();
})();