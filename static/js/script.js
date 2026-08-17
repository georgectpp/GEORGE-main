/* ==========================================================================
   GEORGE — Comunidad Estudiantil SPA
   Foro, Test Vocacional y Chat Realtime
   ========================================================================== */

(function () {
  'use strict';

  // ==================================================================
  // 1. IDENTIFICACIÓN REAL (CONECTADO A FLASK)
  // ==================================================================
  let myStudentId = window.USUARIO_REAL;
  
  if (!myStudentId || myStudentId === "") {
      myStudentId = "Estudiante Anónimo";
  }
  
  console.log("Sesión verificada por Flask. Usuario activo:", myStudentId);

  // ==================================================================
  // ESTADO GLOBAL Y CONSTANTES
  // ==================================================================
  const state = { 
      currentView: 'feed', 
      currentCategory: 'all', 
      searchTerm: '' 
  };

  const CATEGORY_META = {
      casual: { label: 'Casual', icon: 'fa-umbrella-beach', tagClass: 'tag-casual' },
      problemas: { label: 'Problemas', icon: 'fa-heart-circle-exclamation', tagClass: 'tag-problemas' },
      preguntas: { label: 'Preguntas', icon: 'fa-circle-question', tagClass: 'tag-preguntas' },
      opiniones: { label: 'Opiniones', icon: 'fa-comments', tagClass: 'tag-opiniones' },
      encuestas: { label: 'Encuestas', icon: 'fa-chart-simple', tagClass: 'tag-encuestas' },
  };

  const FEED_TITLES = { 
      all: 'Foro Estudiantil', 
      casual: 'Casual', 
      problemas: 'Problemas', 
      preguntas: 'Preguntas', 
      opiniones: 'Opiniones', 
      encuestas: 'Encuestas' 
  };

  // ==================================================================
  // REFERENCIAS AL DOM
  // ==================================================================
  const navTriggers = document.querySelectorAll('.nav-trigger');
  const views = document.querySelectorAll('.view');
  const feedTitle = document.getElementById('feed-title');
  const feedList = document.getElementById('feed-list');
  const noResults = document.getElementById('no-results');
  const searchInput = document.getElementById('search-input');
  
  const modalOverlay = document.getElementById('modal-overlay');
  const btnNewPost = document.getElementById('btn-new-post');
  const postForm = document.getElementById('post-form');

  // ==================================================================
  // 2. NAVEGACIÓN SPA
  // ==================================================================
  function goToView(viewName) {
      state.currentView = viewName;
      
      views.forEach(section => { 
          section.classList.toggle('is-active', section.dataset.view === viewName); 
      });
      
      navTriggers.forEach(btn => {
          if (!btn.classList.contains('nav-item')) return; 
          
          const matchesView = btn.dataset.view === state.currentView;
          const matchesCategory = state.currentView !== 'feed' || btn.dataset.category === state.currentCategory;
          btn.classList.toggle('is-active', matchesView && matchesCategory);
      });

      if (viewName === 'chat-ia') {
          document.getElementById('chat-input-ia').focus({ preventScroll: true });
      } else if (viewName === 'chat-orientacion') {
          document.getElementById('chat-input-orientacion').focus({ preventScroll: true });
      }
  }

  function setCategory(category) {
      state.currentCategory = category;
      if (feedTitle) {
          feedTitle.textContent = FEED_TITLES[category] || FEED_TITLES.all;
      }
      applyFilters();
  }

  navTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
          const view = trigger.dataset.view;
          if (view === 'feed') {
              setCategory(trigger.dataset.category || 'all');
          }
          goToView(view);
      });
  });
  
  goToView('feed');

  // ==================================================================
  // 3. FORO Y CHAT REAL: CONEXIÓN A FIREBASE
  // ==================================================================
  function openModal() { 
      modalOverlay.classList.add('is-open'); 
      modalOverlay.setAttribute('aria-hidden', 'false'); 
      document.getElementById('post-title').focus(); 
      document.body.style.overflow = 'hidden'; 
  }
  
  function closeModal() { 
      modalOverlay.classList.remove('is-open'); 
      modalOverlay.setAttribute('aria-hidden', 'true'); 
      document.body.style.overflow = ''; 
      postForm.reset(); 
  }

  btnNewPost.addEventListener('click', openModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (event) => { 
      if (event.target === modalOverlay) closeModal(); 
  });

  postForm.addEventListener('submit', function (event) {
      event.preventDefault();
      
      const title = document.getElementById('post-title').value.trim();
      const content = document.getElementById('post-content').value.trim();
      const category = document.getElementById('post-category').value;
      const isAnon = document.getElementById('post-anon').checked;

      if (!title || !content) return;
      
      if (!window.firebaseDatabase) {
          return alert("Conectando con la base de datos...");
      }

      const db = window.firebaseDatabase;
      const { ref, push, set } = window.firebaseDbFunctions;
      
      set(push(ref(db, 'publicaciones')), { 
          titulo: title, 
          contenido: content, 
          categoria: category, 
          autor: isAnon ? "Anónimo" : "Estudiante", 
          idEstudiante: myStudentId,
          fecha: Date.now(), 
          likes: 0 
      })
      .then(() => { 
          closeModal(); 
          goToView('feed'); 
          setCategory('all'); 
      })
      .catch((error) => {
          alert("No se pudo publicar.");
      });
  });

  window.addEventListener('firebase-ready', function () {
      const db = window.firebaseDatabase;
      const { ref, push, set, onChildAdded } = window.firebaseDbFunctions;
      
      // 3.1 CARGAR PUBLICACIONES DEL FORO
      onChildAdded(ref(db, 'publicaciones'), (snapshot) => {
          crearElementoPostEnDOM(snapshot.key, snapshot.val());
          applyFilters(); 
      });

      // 3.2 CARGAR CHAT BIDIRECCIONAL CON ORIENTACIÓN
      const chatFormOr = document.getElementById('chat-form-orientacion');
      const chatInputOr = document.getElementById('chat-input-orientacion');
      const chatBodyOr = document.getElementById('chat-body-orientacion');
      
      chatBodyOr.innerHTML = ''; 
      const miChatRef = ref(db, 'chats_orientacion/' + myStudentId);

      // Enviar mensaje
      chatFormOr.addEventListener('submit', function (e) {
          e.preventDefault();
          const texto = chatInputOr.value.trim();
          if (!texto) return;
          
          set(push(miChatRef), { 
              sender: 'student', 
              text: texto, 
              timestamp: Date.now() 
          });
          
          chatInputOr.value = '';
          chatInputOr.focus();
      });

      // Escuchar mensajes
      onChildAdded(miChatRef, (snapshot) => {
          const msj = snapshot.val();
          const direction = msj.sender === 'student' ? 'out' : 'in';
          const bubble = document.createElement('div');
          
          bubble.className = 'chat-msg chat-msg-' + direction;
          
          const fecha = new Date(msj.timestamp);
          const timeStr = fecha.getHours() + ':' + fecha.getMinutes().toString().padStart(2, '0');
          
          bubble.innerHTML = `
              <p>${escapeHTML(msj.text)}</p>
              <span class="chat-time">${timeStr}</span>
          `;
          
          chatBodyOr.appendChild(bubble);
          chatBodyOr.scrollTop = chatBodyOr.scrollHeight;
      });
  });

  function crearElementoPostEnDOM(idPost, datosPost) {
      const meta = CATEGORY_META[datosPost.categoria] || CATEGORY_META.casual;
      const article = document.createElement('article');
      const esReciente = (Date.now() - datosPost.fecha) < 5000;
      
      article.className = 'post-card' + (esReciente ? ' is-new' : '');
      article.dataset.category = datosPost.categoria;
      article.dataset.id = idPost;

      const esAnonimo = datosPost.autor === 'Anónimo';
      let avatarHTML = '';
      
      if (esAnonimo) {
          avatarHTML = `<div class="avatar avatar-anon"><i class="fa-solid fa-user-secret" aria-hidden="true"></i></div>`;
      } else {
          const iniciales = escapeHTML(datosPost.autor.substring(0, 2).toUpperCase());
          avatarHTML = `<div class="avatar" style="background:var(--rojo-suave);">${iniciales}</div>`;
      }
      
      const fechaObj = new Date(datosPost.fecha);
      const fechaTexto = esReciente ? 'Justo ahora' : fechaObj.toLocaleDateString('es-CR', { 
          hour: '2-digit', 
          minute: '2-digit', 
          day: 'numeric', 
          month: 'short' 
      });

      article.innerHTML = `
          <div class="post-head">
              ${avatarHTML}
              <div class="post-meta">
                  <span class="post-author">${escapeHTML(datosPost.autor)}</span>
                  <span class="post-dot">·</span>
                  <span class="post-time">${fechaTexto}</span>
              </div>
              <span class="tag ${meta.tagClass}">
                  <i class="fa-solid ${meta.icon}" aria-hidden="true"></i>${meta.label}
              </span>
          </div>
          <h2 class="post-title">${escapeHTML(datosPost.titulo)}</h2>
          <p class="post-content">${escapeHTML(datosPost.contenido)}</p>
          <div class="post-actions">
              <button type="button" class="post-action" data-action="reply">
                  <i class="fa-regular fa-comment" aria-hidden="true"></i>Responder
              </button>
              <button type="button" class="post-action" data-action="like">
                  <i class="fa-regular fa-heart" aria-hidden="true"></i>Me ayudó
              </button>
              <button type="button" class="post-action post-action-report" data-action="report">
                  <i class="fa-solid fa-flag" aria-hidden="true"></i>Reportar
              </button>
              <button type="button" class="post-action post-action-delete" data-action="delete">
                  <i class="fa-solid fa-trash" aria-hidden="true"></i>Eliminar
              </button>
              <span class="reply-count">0 respuestas</span>
          </div>
          <div class="reply-box">
              <textarea rows="2" placeholder="Escribe una respuesta…"></textarea>
              <div class="reply-box-actions">
                  <button type="button" class="btn btn-ghost btn-small" data-action="reply-cancel">Cancelar</button>
                  <button type="button" class="btn btn-primary btn-small" data-action="reply-send">Comentar</button>
              </div>
              <div class="reply-list"></div>
          </div>
      `;
      
      feedList.prepend(article);
      
      if (esReciente) {
          article.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }

  function escapeHTML(str) { 
      const div = document.createElement('div'); 
      div.textContent = str; 
      return div.innerHTML; 
  }

  // ==================================================================
  // 4. INTERACTIVIDAD Y BÚSQUEDA DEL FORO
  // ==================================================================
  feedList.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      
      const card = btn.closest('.post-card');
      const action = btn.dataset.action;

      if (action === 'like') {
          const isLiked = btn.classList.toggle('is-liked');
          btn.querySelector('i').classList.toggle('fa-regular', !isLiked); 
          btn.querySelector('i').classList.toggle('fa-solid', isLiked);
      
      } else if (action === 'report') {
          if (btn.classList.contains('is-reported')) return;
          btn.classList.add('is-reported'); 
          btn.innerHTML = '<i class="fa-solid fa-circle-check"></i>Reportado'; 
          btn.disabled = true;
      
      } else if (action === 'reply') {
          const isOpen = card.querySelector('.reply-box').classList.toggle('is-open');
          btn.classList.toggle('is-open', isOpen);
          if (isOpen) {
              card.querySelector('textarea').focus();
          }
      
      } else if (action === 'reply-cancel') {
          card.querySelector('.reply-box').classList.remove('is-open'); 
          card.querySelector('textarea').value = ''; 
          btn.classList.remove('is-open');
      
      } else if (action === 'reply-send') {
          const text = card.querySelector('textarea').value.trim();
          if (!text) return;
          
          const item = document.createElement('div'); 
          item.className = 'reply-item';
          item.innerHTML = `<strong>Tú:</strong><span>${escapeHTML(text)}</span>`;
          card.querySelector('.reply-list').appendChild(item);
          card.querySelector('textarea').value = '';
          
          const counter = card.querySelector('.reply-count');
          counter.textContent = ((parseInt(counter.textContent, 10) || 0) + 1) + ' respuestas';
      
      } else if (action === 'delete') {
          const titleEl = card.querySelector('.post-title');
          const titleText = titleEl ? titleEl.textContent.trim() : 'esta publicación';
          
          if (!window.confirm('¿Seguro que deseas eliminar "' + titleText + '"?')) return;
          
          import("https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js").then(({ remove }) => {
              const postRef = window.firebaseDbFunctions.ref(window.firebaseDatabase, 'publicaciones/' + card.dataset.id);
              remove(postRef).then(() => { 
                  card.remove(); 
                  applyFilters(); 
              }).catch(() => alert("Error al eliminar."));
          });
      }
  });

  searchInput.addEventListener('input', () => { 
      state.searchTerm = searchInput.value.trim().toLowerCase(); 
      applyFilters(); 
  });

  function applyFilters() {
      const cards = feedList.querySelectorAll('.post-card');
      let visibleCount = 0;
      
      cards.forEach(card => {
          const matchesCat = state.currentCategory === 'all' || card.dataset.category === state.currentCategory;
          const title = card.querySelector('.post-title').textContent.toLowerCase();
          const content = card.querySelector('.post-content').textContent.toLowerCase();
          const matchesSearch = state.searchTerm === '' || title.includes(state.searchTerm) || content.includes(state.searchTerm);
          
          const isVis = matchesCat && matchesSearch;
          card.style.display = isVis ? '' : 'none';
          
          if (isVis) visibleCount++;
      });
      
      noResults.classList.toggle('is-hidden', visibleCount !== 0);
  }

  // ==================================================================
  // 5. TEST VOCACIONAL (EXPANDIDO)
  // ==================================================================
  const testQuestions = [
      { 
          question: "Si te dieran el presupuesto para crear un videojuego desde cero, ¿qué rol elegirías?", 
          options: [
              { text: "Programar la inteligencia artificial, la lógica y los movimientos.", category: "tech" }, 
              { text: "Idear cómo venderlo, publicitarlo y gestionar el equipo de trabajo.", category: "negocios" }, 
              { text: "Diseñar los personajes, los escenarios y componer la música.", category: "artes" }, 
              { text: "Asegurarme de que el juego sea educativo, accesible y tenga un impacto positivo.", category: "salud" }
          ] 
      },
      { 
          question: "Ante una situación de emergencia o crisis, tu primera reacción suele ser...", 
          options: [
              { text: "Asumir el mando rápido, delegar tareas y organizar a los demás.", category: "negocios" }, 
              { text: "Analizar fríamente qué está fallando y buscar una herramienta para repararlo.", category: "tech" }, 
              { text: "Mantener la calma, acercarme a los afectados y brindarles primeros auxilios o apoyo emocional.", category: "salud" }, 
              { text: "Documentar lo que pasa o buscar la manera de comunicarlo para que otros entiendan la situación.", category: "artes" }
          ] 
      },
      { 
          question: "¿Qué tipo de contenido (documentales, videos, artículos) te llama más la atención?", 
          options: [
              { text: "Casos médicos complejos, psicología forense o comportamiento humano.", category: "salud" }, 
              { text: "Biografías de emprendedores, análisis de mercados o estrategias de marcas.", category: "negocios" }, 
              { text: "Últimos avances en robótica, viajes espaciales o ciberseguridad.", category: "tech" }, 
              { text: "Historia del cine, movimientos artísticos, fotografía o diseño de moda.", category: "artes" }
          ] 
      },
      { 
          question: "Si tuvieras que dominar una herramienta a la perfección, elegirías...", 
          options: [
              { text: "Software de diseño, una cámara profesional o un instrumento musical.", category: "artes" }, 
              { text: "Lenguajes de programación (Python, C++) o gestión de bases de datos.", category: "tech" }, 
              { text: "Hojas de cálculo financieras, software contable o planes de inversión.", category: "negocios" }, 
              { text: "Instrumental médico, protocolos de rehabilitación o pruebas psicológicas.", category: "salud" }
          ] 
      },
      { 
          question: "¿De qué forma te gustaría impactar positivamente al mundo?", 
          options: [
              { text: "Creando empresas que generen empleo y mejoren la economía global.", category: "negocios" }, 
              { text: "Desarrollando nuevas tecnologías que automaticen y faciliten la vida de todos.", category: "tech" }, 
              { text: "Inspirando a las personas, transmitiendo emociones profundas y contando historias.", category: "artes" }, 
              { text: "Curando enfermedades, promoviendo la salud mental o defendiendo derechos humanos.", category: "salud" }
          ] 
      },
      { 
          question: "Si te regalaran un curso intensivo de fin de semana, ¿cuál elegirías sin dudarlo?", 
          options: [
              { text: "Primeros auxilios avanzados y soporte vital.", category: "salud" }, 
              { text: "Oratoria, liderazgo y negociación efectiva.", category: "negocios" }, 
              { text: "Ilustración digital, escritura creativa o actuación.", category: "artes" }, 
              { text: "Machine Learning (IA) o desarrollo de aplicaciones móviles.", category: "tech" }
          ] 
      },
      { 
          question: "Cuando vas a comprar un producto nuevo (como un celular o computadora), ¿en qué te fijas primero?", 
          options: [
              { text: "En su estética, los colores, el diseño y qué tan bien se ve.", category: "artes" }, 
              { text: "En las especificaciones técnicas: procesador, memoria, batería, etc.", category: "tech" }, 
              { text: "En la relación calidad-precio y el valor de reventa a futuro.", category: "negocios" }, 
              { text: "En qué tan fácil de usar es y si la empresa fabricante es éticamente responsable.", category: "salud" }
          ] 
      },
      { 
          question: "Imagina tu espacio de trabajo ideal en 10 años, ¿cómo se ve?", 
          options: [
              { text: "Un hospital, clínica, consultorio o trabajando en comunidades directamente con la gente.", category: "salud" }, 
              { text: "Una oficina moderna (o viajando), cerrando tratos, en reuniones y dirigiendo un equipo.", category: "negocios" }, 
              { text: "Frente a múltiples pantallas, laboratorios de hardware o trabajando remoto desde mi casa.", category: "tech" }, 
              { text: "Un estudio amplio, lleno de luz, materiales creativos y sin horarios estrictos.", category: "artes" }
          ] 
      },
      { 
          question: "¿Cuál de estos retos te parece más estimulante?", 
          options: [
              { text: "Encontrar el error en cientos de líneas de código que hace que un programa falle.", category: "tech" }, 
              { text: "Diseñar una campaña de publicidad visual que atrape la atención de miles de personas.", category: "artes" }, 
              { text: "Entender los síntomas complejos de un paciente para darle el diagnóstico correcto.", category: "salud" }, 
              { text: "Tomar una empresa que está perdiendo dinero y convertirla en un negocio rentable.", category: "negocios" }
          ] 
      },
      { 
          question: "Por último, ¿cómo te suelen describir tus amigos o familiares?", 
          options: [
              { text: "El/la creativo(a), el que siempre tiene un toque original o estético en lo que hace.", category: "artes" }, 
              { text: "El/la persuasivo(a), quien siempre organiza los planes y sabe cómo convencer a los demás.", category: "negocios" }, 
              { text: "El/la analítico(a), la persona a la que acuden cuando se les arruina la compu o el internet.", category: "tech" }, 
              { text: "El/la empático(a), la persona en la que más confían para contarle sus problemas.", category: "salud" }
          ] 
      }
  ];

  const testProfiles = {
      tech: { 
          title: "Perfil Tecnológico e Ingenieril 💻", 
          desc: "Tienes una mente sumamente analítica, lógica y curiosa. Te apasiona desarmar problemas complejos y construir soluciones que faciliten la vida mediante herramientas digitales, matemáticas o científicas.", 
          careers: ["Ingeniería en Sistemas", "Desarrollo de Software / IA", "Mecatrónica / Electrónica", "Análisis de Datos / Ciberseguridad"] 
      },
      salud: { 
          title: "Perfil de Salud y Ciencias Sociales 🩺", 
          desc: "Destacas enormemente por tu empatía, tu vocación de servicio y tu interés en el bienestar humano. Eres el tipo de profesional que el mundo necesita para cuidar del cuerpo, la mente o los derechos de las personas.", 
          careers: ["Medicina General / Especialidades", "Psicología Clínica o Social", "Enfermería / Fisioterapia", "Trabajo Social / Derecho"] 
      },
      artes: { 
          title: "Perfil Creativo y Artístico 🎨", 
          desc: "Tu mente es un lienzo en blanco. Tienes una gran sensibilidad estética, observas detalles que otros pasan por alto y tienes la increíble capacidad de comunicar mensajes poderosos a través de diferentes medios expresivos.", 
          careers: ["Diseño Gráfico / Industrial", "Arquitectura / Diseño de Interiores", "Animación Digital / Producción Audiovisual", "Bellas Artes / Literatura"] 
      },
      negocios: { 
          title: "Perfil Liderazgo y Negocios 📈", 
          desc: "Eres una persona estratega, persuasiva y con visión a futuro. Te desenvuelves muy bien dirigiendo proyectos, entendiendo cómo funciona el dinero y organizando equipos para alcanzar una meta en común.", 
          careers: ["Administración de Empresas", "Marketing y Publicidad", "Economía / Finanzas", "Emprendimiento e Innovación"] 
      }
  };

  let currentQ = 0; 
  let testScores = { tech: 0, salud: 0, artes: 0, negocios: 0 };
  
  function renderTest() {
      const container = document.getElementById('quiz-content');
      if (!container) return;
      
      container.innerHTML = '';
      
      if(currentQ >= testQuestions.length) {
          return showTestResult();
      }
      
      const q = testQuestions[currentQ];
      const box = document.createElement('div'); 
      box.className = 'question-box active';
      
      box.innerHTML = `<h2 class="question-text">${currentQ + 1}. ${q.question}</h2>`;
      
      q.options.forEach(o => {
          const btn = document.createElement('button'); 
          btn.className = 'option-btn'; 
          btn.textContent = o.text;
          
          btn.onclick = () => { 
              testScores[o.category]++; 
              currentQ++; 
              renderTest(); 
          };
          box.appendChild(btn);
      });
      
      container.appendChild(box);
      document.getElementById('progress').style.width = `${(currentQ / testQuestions.length) * 100}%`;
  }
  
  function showTestResult() {
      document.getElementById('progress').style.width = '100%';
      const winner = Object.keys(testScores).reduce((a, b) => testScores[a] > testScores[b] ? a : b);
      const profile = testProfiles[winner];

      document.getElementById('profile-name').textContent = profile.title;
      document.getElementById('profile-desc').textContent = profile.desc;
      
      const list = document.getElementById('careers-list'); 
      list.innerHTML = '';
      
      profile.careers.forEach(career => { 
          const li = document.createElement('li'); 
          li.textContent = career; 
          list.appendChild(li); 
      });
      
      document.getElementById('result-box').classList.add('active');
  }

  const btnRestartTest = document.getElementById('btn-restart-test');
  
  if (btnRestartTest) {
      btnRestartTest.addEventListener('click', () => {
          currentQ = 0; 
          testScores = { tech:0, salud:0, artes:0, negocios:0 };
          document.getElementById('result-box').classList.remove('active'); 
          renderTest();
      });
  }
  
  renderTest();

})();
