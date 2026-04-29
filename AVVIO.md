# ES Work — Istruzioni di Avvio

## 1. Installa Node.js (una tantum)

Node.js non è installato sul Mac. Aprire il Terminale e incollare:

```bash
# Opzione A — Homebrew (raccomandato):
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node

# Opzione B — Installer diretto:
# Scaricare da https://nodejs.org  →  versione LTS  →  installa
```

Verificare l'installazione:
```bash
node -v   # deve mostrare v20.x.x o superiore
npm -v    # deve mostrare 10.x.x o superiore
```

---

## 2. Installa le dipendenze del progetto

```bash
cd "/Users/enrico/Desktop/App ES work"
npm install
```

---

## 3. Avvia il server di sviluppo

```bash
npm run dev
```

Aprire il browser su **http://localhost:3000**

---

## Credenziali admin (modificabili in .env.local)

| Campo    | Valore            |
|----------|-------------------|
| Email    | admin@eswork.it   |
| Password | eswork2026        |

---

## Struttura URL

| URL                             | Descrizione                              |
|---------------------------------|------------------------------------------|
| `http://localhost:3000/`        | Login admin                              |
| `http://localhost:3000/dashboard` | Lista clienti (richiede login)         |
| `http://localhost:3000/dashboard/{clientId}` | Assessment di un cliente    |
| `http://localhost:3000/q/{share_code}` | Questionario pubblico (mobile)  |

---

## Dati

I dati vengono salvati in `data/db.json` (creato automaticamente al primo avvio).
Per azzerare tutto: eliminare `data/db.json`.

---

## Deploy su Vercel (quando pronto)

1. `git init && git add . && git commit -m "init"`
2. Creare repository su GitHub
3. Collegare a Vercel (vercel.com)
4. Aggiungere le variabili d'ambiente da `.env.local` nelle impostazioni Vercel
5. Per i dati in produzione: migrare a Supabase/PostgreSQL (schema già compatibile)
