const supabaseUrl = 'https://xtnybqqgiftasikzgcos.supabase.co';
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0bnlicXFnaWZ0YXNpa3pnY29zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNjQxNTksImV4cCI6MjA2Njk0MDE1OX0.OLkZI-KafGoLiJHmVwwDWQLBIG6IsJfFIXZHdUxwx68";
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
const taskList = document.getElementById('taskList');
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event, session);
});

function showMessage(msg, color = "red") {
  const msgEl = document.getElementById("message");
  msgEl.textContent = msg;
  msgEl.style.color = color;
}

async function register() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const username = document.getElementById("registerUsername").value.trim();

  if (!email || !password || !username) {
    return showMessage("Tous les champs sont requis");
  }

  const { data: existingUser, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (checkError) {
    console.error("Erreur lors de la vérification du username :", checkError);
    return showMessage("Erreur de vérification");
  }

  if (existingUser) {
    return showMessage("Nom d'utilisateur déjà utilisé");
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
	email,
	password,
  });

  if (signUpError) {
	console.error("Erreur d'inscription :", signUpError);
	return showMessage(signUpError.message);
  }

  const user = signUpData.user;
  if (!user) {
	return showMessage("Inscription réussie, mais utilisateur non connecté");
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert([
      {
        id: user.id,
        email,
        username,
      }
    ]);

  if (profileError) {
	console.error("Erreur lors de l’insertion du profil :", profileError);
	return showMessage("Erreur lors de l'enregistrement du profil");
  }

  showMessage("Compte créé ! Vérifiez votre e-mail pour activer votre compte.", "green");
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return showMessage("Identifiants invalides");

  currentUser = data.user;

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", currentUser.id)
    .single();

  const username = profileData?.username || currentUser.email;

  document.getElementById("authContainer").style.display = "none";
  document.getElementById("todoContainer").style.display = "block";
  document.getElementById("welcome").textContent = "Bienvenue, " + username;

  loadTasks();
}
async function logout() {
  await supabase.auth.signOut();
  currentUser = null;
  document.getElementById("authContainer").style.display = "block";
  document.getElementById("todoContainer").style.display = "none";
  taskList.innerHTML = '';
  document.getElementById("username").value = '';
  document.getElementById("password").value = '';
  showMessage("");
}

async function addTask(text, completed = false, id = null) {
  const li = document.createElement('li');
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  li.appendChild(textSpan);
  if (completed) li.classList.add('completed');

  li.addEventListener('click', async () => {
	if (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT') return;
    const newStatus = !li.classList.contains('completed');
	li.classList.toggle('completed');
	if (id) await supabase.from("tasks").update({ completed: newStatus }).eq("id", id);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Supprimer';
  deleteBtn.classList.add('delete-btn');
  deleteBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  li.remove();
  if (id) await supabase.from("tasks").delete().eq("id", id);
  });

  const editBtn = document.createElement('button');
  editBtn.textContent = 'Modifier';
  editBtn.classList.add('modif-btn');
  editBtn.addEventListener('click', (e) => {
	e.stopPropagation();

	const input = document.createElement('input');
	input.type = 'text';
	input.value = textSpan.textContent;
	li.insertBefore(input, textSpan);
	li.removeChild(textSpan);
	editBtn.style.display = 'none';
	const saveBtn = document.createElement('button');
	saveBtn.textContent = 'Valider';
	saveBtn.classList.add('modif-btn');
	li.insertBefore(saveBtn, deleteBtn);
	saveBtn.addEventListener('click', async (e) => {
		e.stopPropagation();
		const newText = input.value.trim();
		if (!newText) return;

		if (id) {
		  await supabase.from("tasks").update({ text: newText }).eq("id", id);
		}

		textSpan.textContent = newText;
		li.insertBefore(textSpan, input);
		li.removeChild(input);
		li.removeChild(saveBtn);
		editBtn.style.display = '';
	});
  });

  li.appendChild(editBtn);
  li.appendChild(deleteBtn);
  taskList.appendChild(li);

  if (!id) {
	const { data } = await supabase
      .from("tasks")
      .insert([{ text, completed, user_id: currentUser.id }])
      .select();
    id = data[0].id;
  }
}

async function loadTasks() {
  const { data, error } = await supabase
	.from("tasks")
	.select("*")
	.eq("user_id", currentUser.id);
  if (error) return showMessage("Erreur lors du chargement");
  taskList.innerHTML = '';
  data.forEach(task => addTask(task.text, task.completed, task.id));
}

document.getElementById('addTaskBtn').addEventListener('click', () => {
  const taskInput = document.getElementById('taskInput');
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text);
  taskInput.value = '';
});

document.getElementById('searchInput').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('#taskList li').forEach(li => {
	const text = li.firstChild.textContent.toLowerCase();
	li.style.display = text.includes(query) ? '' : 'none';
  });
});