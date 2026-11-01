# Code Health Dashboard

Εφαρμογή για την ανάλυση και παρουσίαση της υγείας λογισμικού και του τεχνικού χρέους. Συνδυάζει μετρικές SonarQube, δεδομένα AllinCode* και ιστορικό Git, υπολογίζει δείκτες σε επίπεδο project και αρχείου και αποθηκεύει τις αναλύσεις.

Υποστηρίζονται δύο τρόποι εγκατάστασης:

- **Docker Compose:** τα τοπικά εργαλεία και services εκτελούνται σε containers.
- **Χειροκίνητη εγκατάσταση σε Windows ή Linux:** οι εξαρτήσεις εγκαθίστανται στο μηχάνημα.

*Το AllinCode είναι εξωτερική υπηρεσία και απαιτεί έγκυρο λογαριασμό και διαθεσιμότητα της υπηρεσίας.

## 1. Δομή του project

| Αρχείο / φάκελος | Περιεχόμενο |
| --- | --- |
| `backend/` | Node.js / Express API και services ανάλυσης |
| `frontend/` | React / Vite dashboard |
| `processing/` | Python pipeline, scoring και μετρικές Git |
| `processing/requirements.txt` | Εξαρτήσεις Python |
| `database/schema.sql` | Σχήμα βάσης χωρίς δεδομένα |
| `database/schema_with_example_data.sql` | Σχήμα και δεδομένα παραδειγμάτων |
| `backend/Dockerfile` | Backend image και εργαλεία ανάλυσης |
| `frontend/Dockerfile` | Frontend image |
| `docker-compose.yml` | Εκκίνηση και σύνδεση των services |
| `.env.example` | Κεντρικές ρυθμίσεις Compose |
| `backend/.env.example` | Backend για χειροκίνητη εγκατάσταση |
| `frontend/.env.example` | Frontend για χειροκίνητη εγκατάσταση |

## 2. Εγκατάσταση με Docker Compose

### Προϋποθέσεις

- Windows με Docker Desktop και WSL 2 ή Linux με Docker Engine και Compose plugin.
- Ενεργό Docker Engine και σύνδεση στο διαδίκτυο.
- Συνιστώνται 16 GB RAM ή περισσότερα για το πλήρες σύστημα. Η κατανάλωση εξαρτάται από το αναλυόμενο project και τους πόρους του Docker.

Δεν χρειάζεται ξεχωριστή εγκατάσταση Node.js, Python, Git, Java, MariaDB, Maven, Gradle ή SonarScanner στον host. Το backend image περιλαμβάνει Node.js 22, Python 3/PyDriller, Git, JDK 21, SonarScanner CLI 8.0.1.6346, Maven, Gradle και το `processing/`.

Η συγκεκριμένη σύνθεση προορίζεται για τοπική εκτέλεση και αξιολόγηση.

### 2.1 Λήψη του project

Κατεβάστε και αποσυμπιέστε το ZIP. Οι εντολές Compose εκτελούνται από τον κεντρικό φάκελο, όπου βρίσκεται το `docker-compose.yml`. Λειτουργούν σε PowerShell, CMD και Linux.

### 2.2 Κεντρικό `.env`

Σε PowerShell:

```powershell
Copy-Item .env.example .env
```

Σε CMD:

```cmd
copy .env.example .env
```

Σε Linux:

```bash
cp .env.example .env
```

Συμπληρώστε στο κεντρικό `.env`:

- `DB_PASSWORD`: νέο μη κενό password για τον χρήστη της βάσης.
- `DB_ROOT_PASSWORD`: νέο μη κενό password για τον διαχειριστή της MariaDB.
- `ALLINCODE_BASE_URL`, `ALLINCODE_EMAIL`, `ALLINCODE_PASSWORD`: στοιχεία πρόσβασης στην υπηρεσία.
- `SONAR_TOKEN`: αρχικά κενό, δημιουργείται στην ενότητα 2.5.
- `DB_USER`: επιλέξετε ένα όνομα, διαφορετικό από `root`. Οι κωδικοί αφορούν τη νέα βάση του Docker.
- Τα παρεχόμενα SQL δημιουργούν τη βάση `analyzed_projects`. Κρατήστε `DB_NAME=analyzed_projects`, εκτός αν προσαρμόσετε αντίστοιχα το SQL.

Σχετικά με το Sonaqube, προτείνεται η παρακάτω έκδοση(οι ρυθμησεις για τα Quality Profiles αφορούν επίσης αυτή την έκδοση):

```dotenv
SONARQUBE_IMAGE=sonarqube:26.10.0.133078-community
```

Χρησιμοποιήστε την ίδια τιμή στο κεντρικό `.env.example`. Το γενικό tag `sonarqube:community` μπορεί μελλοντικά να αντιστοιχεί σε διαφορετική έκδοση.

Οι βασικές διευθύνσεις του Compose είναι:

```dotenv
DB_HOST=db
SONAR_URL=http://sonarqube:9000
SONAR_SCANNER_HOME=/opt/sonar-scanner
VITE_API_URL=http://localhost:3000
VITE_DEV_HOST=0.0.0.0
```

Το backend επικοινωνεί μέσω των ονομάτων `db` και `sonarqube`. Το `VITE_API_URL` χρησιμοποιείται από τον browser και πρέπει να είναι προσβάσιμο από το μηχάνημα του χρήστη.

Το πλήρες Compose χρησιμοποιεί το κεντρικό `.env`, όχι τα `.env` ή `.env.docker` των υποφακέλων.

Μην καταχωρίσετε credentials σε μεταβλητές `VITE_*`, καθώς είναι προσβάσιμες στον browser.

### 2.3 Ρυθμίσεις Linux host για SonarQube

Το SonarQube χρησιμοποιεί Elasticsearch και απαιτεί `vm.max_map_count` τουλάχιστον `524288`.

**Windows / Docker Desktop με WSL 2**, με ανοιχτό Docker Desktop, σε PowerShell ή CMD:

```powershell
wsl -d docker-desktop -u root sysctl vm.max_map_count
```

Μόνο αν η τιμή είναι μικρότερη από `524288`:

```powershell
wsl -d docker-desktop -u root sysctl -w vm.max_map_count=524288
```

Αν είναι μεγαλύτερη, μην τη μειώσετε. Η αλλαγή μπορεί να χρειαστεί επανάληψη μετά από επανεκκίνηση WSL/Docker.

**Linux host:**

```bash
sysctl vm.max_map_count
```

Αν απαιτείται αύξηση:

```bash
sudo sysctl -w vm.max_map_count=524288
```

Για μόνιμη εφαρμογή, προσθέστε `vm.max_map_count=524288` σε αρχείο κάτω από το `/etc/sysctl.d/` και εφαρμόστε με `sudo sysctl --system`, εφόσον δεν υπάρχει ήδη κατάλληλη ρύθμιση.

Το `fs.file-max` πρέπει επίσης να είναι τουλάχιστον `131072`. Το Compose ορίζει `nofile=131072` και `nproc=8192` για το SonarQube container.

### 2.4 Πρώτη εκκίνηση βάσης και SonarQube

Με ενεργό το Docker, ελέγξτε τη σύνταξη χωρίς εμφάνιση credentials:

```bash
docker compose config --quiet
```

Ξεκινήστε τη βάση και το SonarQube:

```bash
docker compose up -d db sonarqube
docker compose ps
```

Η πρώτη εκκίνηση μπορεί να χρειαστεί αρκετά λεπτά. Η κατάσταση `health: starting` σημαίνει ότι εκκρεμεί ο έλεγχος ετοιμότητας.

Η MariaDB εισάγει αυτόματα το επιλεγμένο SQL μέσω `/docker-entrypoint-initdb.d`, **μόνο κατά την αρχικοποίηση άδειου volume**. Δεν απαιτείται HeidiSQL.

Επιλέξτε ένα SQL στο κεντρικό `.env`:

| Ρύθμιση | Αποτέλεσμα |
| --- | --- |
| `SQL_INIT_FILE=./database/schema.sql` | Κενή βάση με τους τέσσερις πίνακες |
| `SQL_INIT_FILE=./database/schema_with_example_data.sql` | Σχήμα και αποθηκευμένα παραδείγματα |

### 2.5 SonarQube token

1. Ανοίξτε το `http://localhost:9000` όταν το SonarQube είναι έτοιμο.
2. Στην πρώτη εκκίνηση συνδεθείτε με username `admin` και password `admin` και ορίστε νέο password.
3. Μεταβείτε στο **My Account → Security**.
4. Δημιουργήστε **User Token**, π.χ. `codehealth-dashboard`.
5. Αντιγράψτε το token στο κεντρικό `.env`:

```dotenv
SONAR_TOKEN=το_δικό_σας_token
```

Ο χρήστης του token πρέπει να έχει τα απαιτούμενα δικαιώματα ανάλυσης, δημιουργίας project και πρόσβασης στα αποτελέσματα. Token άλλης εγκατάστασης SonarQube δεν ισχύει στον νέο server.

### 2.6 Quality Profiles και διαφορές αποτελεσμάτων

Τα αποτελέσματα μπορεί να διαφέρουν ανάλογα με την έκδοση SonarQube, τους αναλυτές, τα Quality Profiles, τους ενεργούς κανόνες, τα exclusions και τα διαθέσιμα στοιχεία build.

Στην έκδοση **26.10.0.133078**, για ευρύτερο σύνολο ελέγχων προτείνεται το **Sonar way comprehensive** στις γλώσσες του project, όπως Java, JavaScript και Python, όπου διατίθεται.

Πριν από την πρώτη ανάλυση:

1. Συνδεθείτε ως διαχειριστής και ανοίξτε το **Quality Profiles**.
2. Εντοπίστε το **Sonar way comprehensive** για την επιθυμητή γλώσσα.
3. Από το μενού του profile επιλέξτε **Set as Default**.
4. Για υπάρχον project, στο **Project Settings → Quality Profiles**, επιβεβαιώστε το **Instance default** ή επιλέξτε ρητά το επιθυμητό profile.

Η προεπιλογή ορίζεται ανά γλώσσα. Project με συγκεκριμένο profile δεν αλλάζει αυτόματα όταν αλλάξει η προεπιλογή.

Μετά από αλλαγή profile απαιτείται νέα ανάλυση. Οι αποθηκευμένες αναλύσεις του dashboard δεν επανυπολογίζονται αυτόματα.

Το comprehensive δεν εγγυάται ίδιους αριθμούς με άλλες εκδόσεις. Για σύγκριση καταγράψτε έκδοση, profiles, παραμέτρους, scope και commit. Οι ρυθμίσεις διατηρούνται στα SonarQube volumes.

### 2.7 Εκκίνηση όλου του συστήματος

Μετά την καταχώριση του token και τη ρύθμιση των profiles:

```bash
docker compose up -d --build
docker compose ps
```

Το backend περιμένει να είναι έτοιμα η βάση και το SonarQube. Το frontend περιμένει να περάσει ο έλεγχος ετοιμότητας του backend.

| Υπηρεσία | Διεύθυνση |
| --- | --- |
| Dashboard | http://localhost:5173 |
| Backend / projects | http://localhost:3000/api/projects |
| SonarQube | http://localhost:9000 |

Οι θύρες ρυθμίζονται από το κεντρικό `.env`. Η MariaDB είναι προσβάσιμη εσωτερικά στο Docker network.

## 3. Επόμενη χρήση Docker

Ανοίξτε το Docker και από τον κεντρικό φάκελο, εκτελέστε:

```bash
docker compose up -d
docker compose ps
```

Στη συνέχεια ανοίξτε το dashboard στο `http://localhost:5173`.

Διακοπή υπηρεσιών:

```bash
docker compose down
```

Τα δεδομένα βάσης, SonarQube και αποτελεσμάτων διατηρούνται σε volumes. **Μην χρησιμοποιείτε `docker compose down -v`**, αν θέλετε να τα κρατήσετε.

## 4. Χειροκίνητη εγκατάσταση χωρίς Docker

### 4.1 Απαραίτητο λογισμικό

Εγκαταστήστε:

- Node.js 22.12 ή νεότερο της σειράς 22, μαζί με npm.
- Python 3 και Git.
- MariaDB, αυτόνομα ή μέσω XAMPP.
- JDK συμβατό με SonarQube, scanner και αναλυόμενο project. Το Docker image χρησιμοποιεί JDK 21.
- SonarQube Community Build και SonarScanner CLI.
- Maven ή Gradle, ανάλογα με το Java project.
- Προαιρετικά, HeidiSQL ή άλλο SQL client.

Απαιτούνται σύνδεση στο διαδίκτυο και έγκυρα στοιχεία AllinCode. Τα Git, Node.js, npm, Java και τα απαιτούμενα εργαλεία build πρέπει να είναι διαθέσιμα από τη γραμμή εντολών.

### 4.2 Βάση δεδομένων και SonarQube

Ξεκινήστε τη MariaDB. Αν χρησιμοποιείτε XAMPP, πατήστε **Start** στη MySQL από το Control Panel.

Συνδεθείτε μέσω HeidiSQL ή άλλου SQL client με τα στοιχεία της εγκατάστασής σας: συνήθως host `127.0.0.1` και port `3306`. Ανοίξτε και εκτελέστε **ένα** από τα αρχεία:

- `database/schema.sql`: σχήμα χωρίς δεδομένα.
- `database/schema_with_example_data.sql`: σχήμα με αποθηκευμένα παραδείγματα.

Τα SQL δημιουργούν τη βάση `analyzed_projects` και τους πίνακες `projects`, `analysis_runs`, `merged_file_metrics`, `project_trend_history`. Δεν χρειάζεται ξεχωριστό `CREATE DATABASE`.

Μετά την εισαγωγή μπορείτε να κλείσετε το HeidiSQL, διατηρώντας ενεργή τη MariaDB.

Ξεκινήστε το SonarQube. Στα Windows εκτελέστε το `StartSonar.bat` από τον υποφάκελο `bin/windows-x86-64/` της εγκατάστασής του. Όταν είναι διαθέσιμο στο `http://localhost:9000`, δημιουργήστε token και ρυθμίστε τα Quality Profiles σύμφωνα με τις ενότητες **2.5–2.6**.

### 4.3 Ρυθμίσεις περιβάλλοντος

Για χειροκίνητη εγκατάσταση χρησιμοποιούνται τα `backend/.env` και `frontend/.env`, όχι το κεντρικό `.env` του Compose.

Από τον κεντρικό φάκελο:

Σε PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Σε CMD:

```cmd
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Σε Linux:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Στο `backend/.env` συμπληρώστε τα στοιχεία βάσης, SonarQube και AllinCode. Ενδεικτικές τοπικές ρυθμίσεις:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=analyzed_projects
PORT=3000
SONAR_URL=http://localhost:9000
PROCESSING_DIR=../processing
RESULTS_DIR=./results
TEMP_DIR=./tmp
```

Το `SONAR_SCANNER_HOME` δείχνει στον φάκελο εγκατάστασης του scanner, **όχι στο `bin/` ή στο αρχείο `.bat`**. Για παράδειγμα, `C:/tools/sonar-scanner` στα Windows ή `/opt/sonar-scanner` στο Linux. Αν μείνει κενό, ο scanner πρέπει να είναι διαθέσιμος στο PATH.

Το `PYTHON_CMD` ορίζεται σε `python` στα Windows ή συνήθως `python3` στο Linux. Μπορεί να περιέχει και πλήρη διαδρομή εκτελέσιμου Python, χωρίς πρόσθετα ορίσματα.

Οι σχετικές διαδρομές `PROCESSING_DIR`, `RESULTS_DIR` και `TEMP_DIR` υπολογίζονται ως προς το `backend/`. Για προβλήματα μεγάλων διαδρομών στα Windows, χρησιμοποιήστε σύντομη διαδρομή, π.χ. `TEMP_DIR=C:/chd-tmp`.

Στο `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:3000
VITE_DEV_HOST=localhost
VITE_DEV_PORT=5173
```

### 4.4 Εκτέλεση της εφαρμογής

Με τη MariaDB και το SonarQube ενεργά, ανοίξτε τερματικό στον κεντρικό φάκελο:

```bash
cd backend
node server.js
```

Αναμένεται `Server listening on port 3000`, εφόσον `PORT=3000`.

Σε δεύτερο τερματικό, από τον κεντρικό φάκελο:

```bash
cd frontend
npm run dev
```
Ανοίξτε τη διεύθυνση που εμφανίζει το Vite, συνήθως `http://localhost:5173`. Τα δύο τερματικά πρέπει να παραμένουν ανοιχτά. Το **Ctrl+C** σταματά το αντίστοιχο πρόγραμμα.

## 5. Μεταβλητές περιβάλλοντος

### Εφαρμογή

| Μεταβλητή | Περιγραφή |
| --- | --- |
| `PORT` | Θύρα backend, συνήθως `3000` |
| `DB_HOST`, `DB_PORT` | Host και θύρα βάσης |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Στοιχεία σύνδεσης βάσης |
| `SONAR_URL`, `SONAR_TOKEN` | Διεύθυνση SonarQube και token |
| `SONAR_SCANNER_HOME` | Φάκελος scanner, κενό για PATH |
| `SONAR_POLL_INTERVAL_MS` | Διάστημα ελέγχου SonarQube, `2000` ms |
| `SONAR_ANALYSIS_TIMEOUT_MS` | Όριο αναμονής εργασίας και μετρικών μετά τον scanner, `120000` ms |
| `ALLINCODE_BASE_URL` | Βασική διεύθυνση API AllinCode |
| `ALLINCODE_EMAIL`, `ALLINCODE_PASSWORD` | Στοιχεία λογαριασμού |
| `ALLINCODE_POLL_INTERVAL_MS` | Διάστημα ελέγχου AllinCode, `5000` ms |
| `ALLINCODE_ANALYSIS_TIMEOUT_MS` | Όριο αναμονής AllinCode, `86400000` ms / 24 ώρες |
| `ALLINCODE_STEP_STALL_TIMEOUT_MS` | Μέγιστος χρόνος χωρίς πρόοδο στο τρέχον βήμα της AllinCode ανάλυσης,    προεπιλεγμένα `3600000` ms / 1 ώρα |
| `PYTHON_CMD` | Εκτελέσιμο Python |
| `PROCESSING_DIR` | Φάκελος Python scripts |
| `RESULTS_DIR` | Φάκελος παραγόμενων αποτελεσμάτων |
| `TEMP_DIR` | Φάκελος προσωρινών clones |
| `VITE_API_URL` | Διεύθυνση backend όπως τη βλέπει ο browser |
| `VITE_DEV_HOST`, `VITE_DEV_PORT` | Interface και θύρα Vite |

### Πρόσθετες ρυθμίσεις Compose

| Μεταβλητή | Περιγραφή |
| --- | --- |
| `COMPOSE_PROJECT_NAME` | Όνομα σύνθεσης και πρόθεμα volumes |
| `BIND_ADDRESS` | Διεύθυνση δημοσίευσης θυρών στον host |
| `BACKEND_HOST_PORT`, `FRONTEND_HOST_PORT`, `SONAR_HOST_PORT` | Θύρες πρόσβασης στον host |
| `MARIADB_IMAGE`, `SONARQUBE_IMAGE` | Images υπηρεσιών |
| `DB_ROOT_PASSWORD` | Κωδικός διαχειριστή MariaDB |
| `SQL_INIT_FILE` | SQL πρώτης αρχικοποίησης |
| `SONAR_PORT` | Εσωτερική θύρα SonarQube |
