# ArtCade — Checklist completa di sicurezza, qualità e affidabilità

> **Versione documento**: 1.0  
> **Data**: 2026-06-17  
> **Ambito**: Editor, runtime, Logic Board, progetti locali e servizi futuri

---

## Ambito architetturale

La checklist considera la seguente architettura:

* Editor UI sviluppato in React.
* Wrapper desktop Tauri.
* Editor core e backend in C++.
* Runtime nativo in C++.
* Rendering, input e audio tramite Raylib.
* Modulo matematico basato su raymath.
* Fisica 2D custom.
* Scripting Lua 5.4.
* Logic Board visuale compilata in Lua.
* Progetti, scene, prefab e asset salvati localmente.
* Possibili servizi cloud, marketplace, plugin e collaborazione online futuri.

---

# Classificazione delle priorità

## P0 — Bloccante

Un requisito P0 deve essere completato prima di distribuire una build pubblica o consentire agli utenti di lavorare su progetti importanti.

Un problema P0 può causare:

* perdita o corruzione dei dati;
* esecuzione di codice non autorizzato;
* accesso arbitrario al filesystem;
* crash sistematici;
* comportamento non deterministico grave;
* vulnerabilità della sandbox;
* incompatibilità irreversibili dei progetti.

## P1 — Necessario

Un requisito P1 deve essere completato prima di una beta pubblica stabile.

Un problema P1 può causare:

* esperienza utente inaffidabile;
* prestazioni insufficienti;
* difficoltà di manutenzione;
* errori difficili da diagnosticare;
* incompatibilità tra versioni;
* workflow fragile.

## P2 — Maturità

Un requisito P2 è necessario per rendere ArtCade un prodotto maturo, estendibile e adatto a un utilizzo professionale prolungato.

---

# 1. Architettura generale e separazione delle responsabilità

## P0 — Confini dei moduli

* [ ] Separare chiaramente Editor UI, Editor Core, Engine Core, Runtime, Logic Compiler, Scripting, Physics, Renderer, Asset Pipeline e Serialization.
* [ ] Impedire al frontend React di accedere direttamente alle strutture interne del motore.
* [ ] Fare passare ogni operazione attraverso API esplicite del backend.
* [ ] Separare il codice utilizzato esclusivamente dall'editor da quello incluso nel runtime esportato.
* [ ] Impedire che il runtime dipenda da React, Tauri o componenti esclusivi dell'editor.
* [ ] Separare le responsabilità tra caricamento, validazione, esecuzione e salvataggio.
* [ ] Definire chiaramente chi possiede ogni risorsa.
* [ ] Definire il lifetime di ogni risorsa.
* [ ] Evitare dipendenze circolari tra moduli.
* [ ] Evitare singleton globali non controllati.
* [ ] Evitare stato globale modificabile accessibile da qualsiasi modulo.
* [ ] Evitare che il renderer contenga logica di gameplay.
* [ ] Evitare che il sistema fisico modifichi direttamente l'interfaccia dell'editor.
* [ ] Evitare che il compilatore della Logic Board dipenda dal renderer.
* [ ] Separare i dati serializzati dalle strutture runtime.
* [ ] Utilizzare DTO espliciti per lo scambio di dati tra frontend, editor core e runtime.
* [ ] Validare ogni DTO prima di convertirlo in strutture native.
* [ ] Impedire che un errore in un sottosistema corrompa lo stato degli altri.
* [ ] Definire un ordine di inizializzazione dei sottosistemi.
* [ ] Definire un ordine di shutdown dei sottosistemi.
* [ ] Assicurarsi che lo shutdown avvenga nell'ordine inverso rispetto all'inizializzazione quando necessario.

## P1 — Contratti interni

* [ ] Definire interfacce pubbliche per ogni sottosistema.
* [ ] Documentare input, output, errori e side effect delle API.
* [ ] Documentare precondizioni e postcondizioni.
* [ ] Dichiarare esplicitamente ownership e lifetime dei parametri.
* [ ] Dichiarare se un metodo può fallire.
* [ ] Dichiarare se un metodo è thread-safe.
* [ ] Dichiarare se un metodo può modificare la scena.
* [ ] Dichiarare se un metodo può distruggere entità.
* [ ] Dichiarare se un metodo può essere chiamato durante il rendering.
* [ ] Versionare le API Lua.
* [ ] Versionare il formato della Logic Board.
* [ ] Versionare il formato dei progetti.
* [ ] Versionare il formato delle scene.
* [ ] Versionare il formato dei prefab.
* [ ] Versionare i metadati degli asset.
* [ ] Versionare i protocolli di comunicazione tra editor e core.
* [ ] Stabilire una politica di deprecazione.
* [ ] Stabilire una politica di migrazione.
* [ ] Registrare le decisioni architetturali rilevanti.

## Struttura modulare consigliata

```text
artcade/
├── editor-ui/
├── editor-bridge/
├── editor-core/
├── engine-core/
├── runtime/
├── logic-compiler/
├── scripting/
├── physics2d/
├── renderer/
├── input/
├── audio/
├── assets/
├── serialization/
├── project-system/
├── prefab-system/
├── scene-system/
├── platform/
├── diagnostics/
├── tests/
└── tools/
```

---

# 2. Sicurezza del repository

## P0

* [ ] Inserire `.env` nel `.gitignore`.
* [ ] Inserire certificati, token, file locali e configurazioni private nel `.gitignore`.
* [ ] Non salvare segreti nei file sorgente.
* [ ] Non salvare segreti nei file JSON distribuiti.
* [ ] Non salvare segreti nei file di configurazione inclusi nella build.
* [ ] Verificare che nessun segreto sia presente nella cronologia Git.
* [ ] Revocare immediatamente ogni chiave accidentalmente committata.
* [ ] Non includere token nei file JavaScript del frontend.
* [ ] Non includere token nei file progetto.
* [ ] Non includere credenziali nei template.
* [ ] Non includere credenziali negli esempi.
* [ ] Attivare secret scanning nel repository.
* [ ] Attivare protezioni contro il push di segreti.
* [ ] Bloccare commit diretti sul branch principale.
* [ ] Richiedere il superamento della CI prima del merge.
* [ ] Richiedere almeno una revisione per modifiche critiche.
* [ ] Proteggere i branch di release.
* [ ] Firmare i tag di release quando possibile.
* [ ] Non pubblicare simboli, dump o log contenenti dati sensibili.
* [ ] Non inserire percorsi locali personali negli artifact di distribuzione.

## P1

* [ ] Definire una convenzione per i branch.
* [ ] Definire una convenzione per commit e release.
* [ ] Automatizzare il controllo dei segreti.
* [ ] Automatizzare l'analisi statica.
* [ ] Automatizzare il controllo delle dipendenze.
* [ ] Conservare separatamente configurazione di sviluppo e produzione.
* [ ] Impedire che configurazioni di test entrino nella build di produzione.

---

# 3. Dipendenze e supply chain

## P0

* [ ] Bloccare le dipendenze a versioni precise.
* [ ] Conservare i lockfile nel repository.
* [ ] Evitare dipendenze scaricate dinamicamente a runtime.
* [ ] Evitare script di installazione non necessari.
* [ ] Verificare l'origine delle dipendenze.
* [ ] Verificare la licenza di ogni dipendenza.
* [ ] Verificare la compatibilità della licenza con ArtCade.
* [ ] Analizzare vulnerabilità note.
* [ ] Rimuovere dipendenze non utilizzate.
* [ ] Evitare librerie abbandonate.
* [ ] Evitare pacchetti con manutenzione incerta per funzioni critiche.
* [ ] Non aggiornare automaticamente dipendenze principali senza test.
* [ ] Verificare hash o firme dei pacchetti quando disponibili.
* [ ] Non includere strumenti di sviluppo nel runtime finale.
* [ ] Non includere dipendenze Tauri o React nel runtime nativo esportato.

## P1

* [ ] Generare un inventario delle dipendenze.
* [ ] Generare una Software Bill of Materials.
* [ ] Registrare versione, origine, licenza e utilizzo di ogni libreria.
* [ ] Automatizzare gli aggiornamenti controllati.
* [ ] Testare ogni aggiornamento di Raylib.
* [ ] Testare ogni aggiornamento di Lua.
* [ ] Testare ogni aggiornamento di Tauri.
* [ ] Testare ogni aggiornamento del compilatore C++.
* [ ] Mantenere un elenco delle dipendenze critiche.
* [ ] Prevedere alternative per dipendenze critiche non più mantenute.

---

# 4. Bridge Tauri, React e C++

## P0

* [ ] Esporre al frontend soltanto i comandi strettamente necessari.
* [ ] Non esporre un comando generico di esecuzione.
* [ ] Non esporre un comando generico di lettura file.
* [ ] Non esporre un comando generico di scrittura file.
* [ ] Non permettere al frontend di eseguire comandi shell arbitrari.
* [ ] Non permettere al frontend di avviare processi arbitrari.
* [ ] Non permettere al frontend di caricare librerie native.
* [ ] Non permettere al frontend di accedere a percorsi arbitrari.
* [ ] Validare ogni argomento IPC.
* [ ] Validare tipi, dimensioni e contenuti.
* [ ] Applicare limiti alla dimensione dei payload IPC.
* [ ] Usare DTO versionati.
* [ ] Usare allowlist di operazioni.
* [ ] Sanitizzare ogni testo renderizzato come HTML.
* [ ] Non usare `eval`.
* [ ] Non caricare script remoti.
* [ ] Non caricare risorse remote non autorizzate.
* [ ] Configurare una Content Security Policy restrittiva.
* [ ] Disabilitare capability Tauri non utilizzate.
* [ ] Separare capability di lettura, scrittura, importazione ed esportazione.
* [ ] Non includere stack trace nativi nelle risposte inviate alla UI.
* [ ] Non includere percorsi sensibili negli errori mostrati all'utente.
* [ ] Gestire ogni errore del bridge senza terminare l'editor.
* [ ] Verificare che la finestra o il progetto richiedente siano ancora validi prima di applicare una risposta asincrona.
* [ ] Impedire che una risposta obsoleta sovrascriva dati più recenti.
* [ ] Associare ogni richiesta lunga a un identificatore.
* [ ] Supportare l'annullamento delle richieste lunghe.
* [ ] Applicare timeout alle operazioni che possono bloccarsi.

## P1

* [ ] Registrare le operazioni privilegiate.
* [ ] Mostrare conferma per scritture esterne al progetto.
* [ ] Mostrare conferma per operazioni distruttive.
* [ ] Disabilitare i comandi non validi nello stato corrente.
* [ ] Implementare un sistema di permessi interno.
* [ ] Verificare la compatibilità della versione del bridge.
* [ ] Testare input IPC malformati.
* [ ] Testare payload estremamente grandi.
* [ ] Testare chiamate simultanee.
* [ ] Testare la chiusura del progetto durante una richiesta.

Esempio consigliato:

```text
saveScene(projectId, sceneId, serializedScene)
```

Esempio da evitare:

```text
writeFile(arbitraryPath, arbitraryData)
```

---

# 5. Accesso al filesystem

## P0

* [ ] Definire una directory radice per ogni progetto.
* [ ] Canonicalizzare ogni percorso.
* [ ] Bloccare sequenze `../`.
* [ ] Bloccare path traversal codificati.
* [ ] Bloccare percorsi assoluti non autorizzati.
* [ ] Controllare che il percorso finale resti nella directory consentita.
* [ ] Gestire symlink.
* [ ] Gestire junction di Windows.
* [ ] Verificare symlink anche dopo la canonicalizzazione.
* [ ] Impedire scritture su file di sistema.
* [ ] Impedire scritture fuori dal progetto senza conferma.
* [ ] Impedire cancellazioni fuori dal progetto.
* [ ] Non fidarsi dell'estensione del file.
* [ ] Verificare il formato reale dei file.
* [ ] Imporre dimensioni massime.
* [ ] Imporre profondità massima delle directory importate.
* [ ] Gestire file corrotti.
* [ ] Gestire file incompleti.
* [ ] Gestire file bloccati.
* [ ] Gestire permessi insufficienti.
* [ ] Gestire disco pieno.
* [ ] Gestire filesystem in sola lettura.
* [ ] Gestire nomi riservati su Windows.
* [ ] Gestire caratteri non validi.
* [ ] Gestire nomi Unicode.
* [ ] Gestire percorsi molto lunghi.
* [ ] Normalizzare i separatori dei percorsi.
* [ ] Evitare collisioni tra filesystem case-sensitive e case-insensitive.
* [ ] Non usare il nome visuale di un'entità come percorso senza sanitizzazione.
* [ ] Non usare input utente direttamente nei nomi dei file.
* [ ] Non seguire automaticamente collegamenti esterni contenuti nei progetti.

## P1

* [ ] Utilizzare scritture atomiche.
* [ ] Scrivere prima in un file temporaneo.
* [ ] Eseguire flush quando necessario.
* [ ] Rinominare il file temporaneo soltanto dopo il completamento.
* [ ] Conservare backup prima di sovrascritture importanti.
* [ ] Ripulire file temporanei dopo errori.
* [ ] Ripulire file temporanei dopo crash.
* [ ] Rilevare file modificati esternamente.
* [ ] Gestire conflitti tra modifiche interne ed esterne.
* [ ] Mostrare messaggi chiari per file non accessibili.
* [ ] Calcolare hash per individuare contenuti duplicati.
* [ ] Evitare duplicazioni accidentali durante importazioni ripetute.

# 6. Formato dei progetti

## P0

* [ ] Definire uno schema formale.
* [ ] Inserire sempre `projectFormatVersion`.
* [ ] Inserire sempre `engineVersion`.
* [ ] Inserire un `projectId` stabile.
* [ ] Validare il file prima del caricamento.
* [ ] Rifiutare proprietà obbligatorie mancanti.
* [ ] Rifiutare tipi incompatibili.
* [ ] Rifiutare valori fuori intervallo.
* [ ] Rifiutare riferimenti a risorse inesistenti.
* [ ] Applicare limiti alla profondità.
* [ ] Applicare limiti al numero di elementi.
* [ ] Applicare limiti alla dimensione totale.
* [ ] Non istanziare classi native da stringhe non validate.
* [ ] Non eseguire script durante la semplice apertura del progetto.
* [ ] Non avviare automaticamente il gioco all'apertura.
* [ ] Non caricare plugin automaticamente.
* [ ] Non modificare il progetto originale se la validazione fallisce.
* [ ] Non modificare il progetto originale se la migrazione fallisce.
* [ ] Creare un backup prima di una migrazione.
* [ ] Validare il risultato dopo una migrazione.
* [ ] Impedire riferimenti ciclici non supportati.
* [ ] Impedire ID duplicati.
* [ ] Impedire scene duplicate con lo stesso ID.
* [ ] Impedire prefab duplicati con lo stesso ID.
* [ ] Impedire asset duplicati con lo stesso ID.
* [ ] Normalizzare i dati prima del salvataggio.
* [ ] Evitare campi ambigui.
* [ ] Separare dati obbligatori e opzionali.

## P1

* [ ] Implementare migrazioni incrementali.
* [ ] Evitare migrazioni dirette non testate tra versioni molto distanti.
* [ ] Testare l'apertura di progetti precedenti.
* [ ] Conservare una copia del progetto originale.
* [ ] Mostrare un riepilogo della migrazione.
* [ ] Registrare la versione di origine.
* [ ] Registrare la versione di destinazione.
* [ ] Supportare un controllo di integrità.
* [ ] Separare cache rigenerabile e dati essenziali.
* [ ] Utilizzare percorsi relativi.
* [ ] Evitare percorsi assoluti.
* [ ] Normalizzare ID e riferimenti.
* [ ] Documentare ogni modifica incompatibile.
* [ ] Inserire checksum per file critici quando utile.

Esempio:

```json
{
  "projectFormatVersion": 3,
  "engineVersion": "0.8.0",
  "projectId": "project_x",
  "settings": {},
  "scenes": [],
  "prefabs": [],
  "assets": [],
  "plugins": []
}
```

---

# 7. Salvataggio, autosave e prevenzione della perdita dati

## P0

* [ ] Mostrare chiaramente lo stato non salvato.
* [ ] Mostrare quale scena contiene modifiche.
* [ ] Mostrare quali prefab contengono modifiche.
* [ ] Impedire la chiusura accidentale con modifiche non salvate.
* [ ] Impedire il cambio progetto accidentale con modifiche non salvate.
* [ ] Usare salvataggi atomici.
* [ ] Non sovrascrivere il file valido prima del completamento del nuovo.
* [ ] Verificare che il file scritto sia leggibile.
* [ ] Verificare che il file scritto sia valido.
* [ ] Conservare almeno un backup valido.
* [ ] Implementare crash recovery.
* [ ] Non fallire silenziosamente.
* [ ] Mostrare la causa del fallimento.
* [ ] Mostrare il percorso coinvolto.
* [ ] Testare disco pieno.
* [ ] Testare permessi mancanti.
* [ ] Testare interruzione del processo.
* [ ] Testare arresto del sistema.
* [ ] Testare file bloccati.
* [ ] Testare salvataggi simultanei.
* [ ] Evitare salvataggi concorrenti dello stesso file.
* [ ] Serializzare su uno snapshot coerente.
* [ ] Non salvare strutture mentre vengono modificate.
* [ ] Impedire che l'autosave sovrascriva un salvataggio manuale più recente.
* [ ] Impedire che un autosave obsoleto venga ripristinato sopra dati più recenti.
* [ ] Mostrare chiaramente quando viene ripristinato un autosave.

## P1

* [ ] Autosave configurabile.
* [ ] Intervallo autosave configurabile.
* [ ] Autosave separato dal salvataggio manuale.
* [ ] Conservare più snapshot.
* [ ] Limitare il numero di snapshot.
* [ ] Ripristinare selettivamente scene.
* [ ] Ripristinare selettivamente prefab.
* [ ] Ripristinare selettivamente configurazioni.
* [ ] Conservare cronologia delle migrazioni.
* [ ] Creare backup prima di operazioni massive.
* [ ] Creare backup prima di rinominare asset globalmente.
* [ ] Creare backup prima di eliminare prefab.
* [ ] Implementare undo/redo basato su comandi.
* [ ] Rendere i comandi undo deterministici.
* [ ] Limitare la memoria della cronologia.
* [ ] Eliminare in sicurezza comandi non più ripristinabili.
* [ ] Segnalare quando un'operazione non è annullabile.

---

# 8. Sandbox Lua

## P0

* [ ] Non esporre l'intera standard library Lua.
* [ ] Rimuovere o limitare `os`.
* [ ] Rimuovere o limitare `io`.
* [ ] Rimuovere `debug` dalle build pubbliche.
* [ ] Limitare `package`.
* [ ] Bloccare `package.loadlib`.
* [ ] Bloccare `dofile`.
* [ ] Bloccare `loadfile`.
* [ ] Valutare attentamente `load`.
* [ ] Impedire il caricamento di librerie native.
* [ ] Impedire l'esecuzione di processi.
* [ ] Impedire comandi shell.
* [ ] Impedire accesso arbitrario al filesystem.
* [ ] Impedire accesso di rete non autorizzato.
* [ ] Non esporre puntatori C++.
* [ ] Non esporre riferimenti nativi non validabili.
* [ ] Usare handle con generazione o versione.
* [ ] Verificare che gli handle siano ancora validi.
* [ ] Invalidare gli handle dopo la distruzione.
* [ ] Separare script interni e script utente.
* [ ] Separare ambiente editor e ambiente runtime.
* [ ] Limitare le API disponibili in base al contesto.
* [ ] Applicare un limite di istruzioni.
* [ ] Interrompere loop infiniti.
* [ ] Applicare un budget temporale per frame.
* [ ] Gestire errori Lua senza terminare il runtime.
* [ ] Gestire errori Lua senza terminare l'editor.
* [ ] Associare l'errore allo script corretto.
* [ ] Associare l'errore alla riga corretta.
* [ ] Associare l'errore alla regola Logic Board corretta.
* [ ] Non permettere a uno script di corrompere lo stato globale.
* [ ] Non permettere a uno script di modificare strutture durante iterazioni non sicure.
* [ ] Non permettere a uno script di usare entità distrutte.
* [ ] Non permettere a uno script di accedere alla scena precedente dopo un cambio scena.
* [ ] Non permettere a uno script di chiamare API non valide nella fase corrente.
* [ ] Pulire correttamente lo stack Lua dopo ogni chiamata.
* [ ] Verificare il numero dei valori restituiti.
* [ ] Verificare i tipi degli argomenti.
* [ ] Non lasciare errori Lua ignorati.

## P1

* [ ] Definire un limite di memoria.
* [ ] Usare un allocator monitorato.
* [ ] Misurare memoria per script.
* [ ] Misurare tempo per script.
* [ ] Misurare chiamate API per script.
* [ ] Mostrare warning per script costosi.
* [ ] Supportare stack trace leggibili.
* [ ] Supportare hot reload controllato.
* [ ] Definire il comportamento dello stato durante hot reload.
* [ ] Impedire hot reload durante operazioni incompatibili.
* [ ] Isolare ambienti Lua quando necessario.
* [ ] Consentire soltanto moduli approvati.
* [ ] Versionare i moduli Lua inclusi.
* [ ] Implementare timeout per callback.
* [ ] Registrare script disabilitati automaticamente.
* [ ] Permettere di disabilitare uno script problematico.

Ambiente minimo consigliato:

```text
Disponibili:
- math
- table
- subset controllato di string
- API ArtCade
- logging controllato

Non disponibili:
- os.execute
- io.open arbitrario
- package.loadlib
- debug
- accesso completo al filesystem
- accesso di rete arbitrario
```

---

# 9. API Lua di ArtCade

## P0

* [ ] Definire convenzioni coerenti per i nomi.
* [ ] Validare ogni parametro.
* [ ] Validare il numero degli argomenti.
* [ ] Validare i tipi.
* [ ] Validare gli intervalli.
* [ ] Validare gli handle.
* [ ] Restituire errori espliciti.
* [ ] Evitare comportamenti impliciti con `nil`.
* [ ] Evitare crash C++ causati da input Lua.
* [ ] Evitare eccezioni non intercettate.
* [ ] Controllare la validità dell'owner.
* [ ] Controllare che l'entità non sia stata distrutta.
* [ ] Controllare che la scena sia ancora attiva.
* [ ] Definire quali API sono consentite in `onStart`.
* [ ] Definire quali API sono consentite in `onTick`.
* [ ] Definire quali API sono consentite in `onDestroy`.
* [ ] Definire quali API sono consentite durante una collisione.
* [ ] Definire l'ordine delle callback.
* [ ] Definire cosa accade se una callback distrugge il proprio owner.
* [ ] Definire cosa accade se una callback cambia scena.
* [ ] Definire cosa accade se una callback genera nuove entità.
* [ ] Definire cosa accade se una callback modifica componenti.
* [ ] Impedire modifiche strutturali non sicure durante l'iterazione.
* [ ] Accodare le modifiche quando necessario.
* [ ] Non restituire riferimenti mutabili interni.
* [ ] Non esporre oggetti nativi senza wrapper.
* [ ] Garantire che gli errori abbiano codici stabili.

## P1

* [ ] Generare documentazione automaticamente.
* [ ] Generare autocompletamento.
* [ ] Fornire type annotations.
* [ ] Supportare Lua Language Server.
* [ ] Segnalare API deprecate.
* [ ] Mantenere un changelog.
* [ ] Testare compatibilità tra versioni.
* [ ] Fornire esempi verificati.
* [ ] Distinguere errori, warning e misuse.
* [ ] Aggiungere suggerimenti correttivi negli errori.
* [ ] Esporre metadati delle API al Logic Board.
* [ ] Usare la stessa definizione per documentazione, binding e compilatore visuale.

---

# 10. Logic Board e compilatore

## P0 — Modello dei dati

* [ ] Ogni board deve avere un ID stabile.
* [ ] Ogni evento deve avere un ID stabile.
* [ ] Ogni condizione deve avere un ID stabile.
* [ ] Ogni azione deve avere un ID stabile.
* [ ] Ogni riferimento a entità deve usare ID.
* [ ] Ogni riferimento a prefab deve usare ID.
* [ ] Ogni riferimento ad asset deve usare ID.
* [ ] I nomi devono essere soltanto descrittivi.
* [ ] Gli ID non devono cambiare dopo una rinomina.
* [ ] Gli ID non devono essere riutilizzati accidentalmente.
* [ ] Le board duplicate devono ricevere nuovi ID.
* [ ] Gli eventi duplicati devono ricevere nuovi ID.
* [ ] Le azioni duplicate devono ricevere nuovi ID.
* [ ] Le condizioni duplicate devono ricevere nuovi ID.

## P0 — Compilazione

* [ ] La compilazione deve essere deterministica.
* [ ] Lo stesso input deve produrre lo stesso output.
* [ ] L'ordine di esecuzione deve essere documentato.
* [ ] Le regole disabilitate non devono essere eseguite.
* [ ] Le condizioni devono essere valutate nell'ordine previsto.
* [ ] Le azioni devono essere eseguite nell'ordine previsto.
* [ ] Gli stati interni non devono collidere.
* [ ] Gli stati non devono essere condivisi accidentalmente tra istanze.
* [ ] L'inizializzazione deve avvenire una sola volta.
* [ ] `Pressed`, `Held` e `Released` devono avere semantica distinta.
* [ ] Gli eventi edge-based devono conservare correttamente lo stato precedente.
* [ ] Il compilatore deve rifiutare nodi incompleti.
* [ ] Il compilatore deve rifiutare parametri mancanti.
* [ ] Il compilatore deve rifiutare tipi incompatibili.
* [ ] Il compilatore deve rifiutare riferimenti inesistenti.
* [ ] Il compilatore deve rifiutare API non disponibili.
* [ ] Il compilatore deve rispettare `apiVersion`.
* [ ] Il codice generato deve essere sintatticamente valido.
* [ ] Il codice generato deve essere leggibile.
* [ ] Il codice generato deve essere stabile tra compilazioni equivalenti.
* [ ] Il codice generato deve usare soltanto API autorizzate.
* [ ] Il codice generato non deve includere dati non sanitizzati.
* [ ] Il codice generato non deve includere percorsi arbitrari.
* [ ] Il codice generato non deve dipendere dallo stato dell'editor.

## P0 — Sicurezza

* [ ] Eseguire escaping di ogni stringa.
* [ ] Normalizzare gli identificatori.
* [ ] Non trasformare testo utente in codice Lua arbitrario.
* [ ] Non consentire espressioni libere non validate.
* [ ] Imporre limiti alla ricorsione.
* [ ] Imporre limiti agli eventi per frame.
* [ ] Imporre limiti alle azioni per evento.
* [ ] Rilevare loop di eventi.
* [ ] Gestire la reentrancy.
* [ ] Impedire esecuzione dopo distruzione dell'owner.
* [ ] Impedire esecuzione dopo cambio scena.
* [ ] Impedire accesso a riferimenti invalidi.
* [ ] Impedire che una board malformata blocchi l'editor.
* [ ] Impedire che una board enorme esaurisca la memoria.
* [ ] Applicare limiti alla profondità delle condizioni.
* [ ] Applicare limiti al numero di regole.

## P1 — Debuggabilità

* [ ] Creare source mapping tra Lua e Logic Board.
* [ ] Collegare ogni riga generata alla regola.
* [ ] Collegare ogni errore alla condizione o azione.
* [ ] Evidenziare la regola in errore.
* [ ] Mostrare ultima esecuzione.
* [ ] Mostrare durata.
* [ ] Mostrare risultato delle condizioni.
* [ ] Mostrare variabili modificate.
* [ ] Mostrare eventi generati.
* [ ] Supportare breakpoint.
* [ ] Supportare step-by-step.
* [ ] Supportare pausa.
* [ ] Mostrare chiamate eccessive.
* [ ] Mostrare warning di performance.
* [ ] Visualizzare il codice generato in sola lettura.
* [ ] Consentire la copia del codice generato.
* [ ] Non permettere la modifica diretta del codice virtuale generato.

## P1 — Test del compilatore

* [ ] Golden test del Lua generato.
* [ ] Test di board vuote.
* [ ] Test di regole disabilitate.
* [ ] Test di condizioni multiple.
* [ ] Test di azioni multiple.
* [ ] Test di trigger input.
* [ ] Test di collisione.
* [ ] Test di timer.
* [ ] Test di eventi custom.
* [ ] Test di distruzione durante evento.
* [ ] Test di cambio scena durante evento.
* [ ] Test di hot reload.
* [ ] Test di duplicazione.
* [ ] Test di migrazione.
* [ ] Test di nomi contenenti caratteri speciali.
* [ ] Test di stringhe contenenti virgolette.
* [ ] Test di board molto grandi.
* [ ] Test di loop intenzionali.
* [ ] Test di errori di tipo.

# 11. EventBus e gestione degli eventi

## P0

* [ ] Stabilire se gli eventi sono sincroni o accodati.
* [ ] Documentare l'ordine di consegna.
* [ ] Documentare l'ordine dei listener.
* [ ] Gestire subscribe durante dispatch.
* [ ] Gestire unsubscribe durante dispatch.
* [ ] Evitare iterator invalidation.
* [ ] Rimuovere listener di oggetti distrutti.
* [ ] Impedire riferimenti pendenti.
* [ ] Imporre un limite agli eventi per frame.
* [ ] Rilevare loop `A → B → A`.
* [ ] Stabilire cosa accade se un listener emette un evento.
* [ ] Stabilire cosa accade se un listener distrugge il mittente.
* [ ] Stabilire cosa accade se un listener cambia scena.
* [ ] Stabilire cosa accade se un listener si rimuove.
* [ ] Gestire errori dei listener.
* [ ] Impedire che un listener blocchi il frame.
* [ ] Impedire dispatch su scene non più attive.
* [ ] Impedire duplicazioni involontarie degli eventi.
* [ ] Definire se gli eventi persistono tra frame.
* [ ] Definire se gli eventi persistono tra scene.
* [ ] Non conservare payload con riferimenti invalidi.

## P1

* [ ] Aggiungere priorità soltanto quando necessarie.
* [ ] Aggiungere tracing.
* [ ] Misurare numero di eventi.
* [ ] Misurare durata dei listener.
* [ ] Identificare eventi non consumati.
* [ ] Identificare listener mai rimossi.
* [ ] Identificare eventi ricorsivi.
* [ ] Mostrare un debugger degli eventi.
* [ ] Supportare filtri.
* [ ] Supportare registrazione e replay degli eventi quando utile.

---

# 12. Sicurezza e qualità C++

## P0

* [ ] Usare RAII.
* [ ] Evitare ownership tramite raw pointer.
* [ ] Dichiarare ownership esplicitamente.
* [ ] Evitare use-after-free.
* [ ] Evitare double free.
* [ ] Evitare dangling reference.
* [ ] Evitare riferimenti a elementi riallocati.
* [ ] Invalidare handle distrutti.
* [ ] Usare handle generazionali quando opportuno.
* [ ] Non lanciare eccezioni attraverso C API.
* [ ] Non lanciare eccezioni attraverso Lua.
* [ ] Non lanciare eccezioni attraverso FFI.
* [ ] Intercettare eccezioni ai confini.
* [ ] Non ignorare valori di ritorno critici.
* [ ] Controllare conversioni numeriche.
* [ ] Controllare overflow.
* [ ] Controllare underflow.
* [ ] Controllare indici.
* [ ] Controllare dimensioni.
* [ ] Non fidarsi delle lunghezze provenienti dai file.
* [ ] Non fidarsi delle lunghezze provenienti da IPC.
* [ ] Evitare buffer manuali.
* [ ] Evitare cast non sicuri.
* [ ] Evitare `reinterpret_cast` non motivati.
* [ ] Inizializzare sempre le variabili.
* [ ] Inizializzare sempre le strutture.
* [ ] Evitare comportamento indefinito.
* [ ] Evitare accesso concorrente non sincronizzato.
* [ ] Separare handle pubblici e puntatori interni.
* [ ] Non esporre riferimenti a container modificabili.
* [ ] Verificare i risultati delle allocazioni quando necessario.

## P1

* [ ] Abilitare warning elevati.
* [ ] Trattare warning importanti come errori.
* [ ] Usare static analysis.
* [ ] Usare AddressSanitizer.
* [ ] Usare UndefinedBehaviorSanitizer.
* [ ] Usare ThreadSanitizer per codice concorrente.
* [ ] Usare leak detection.
* [ ] Usare iterator debugging.
* [ ] Testare Debug.
* [ ] Testare Release.
* [ ] Testare build con ottimizzazioni.
* [ ] Evitare logiche differenti tra Debug e Release.
* [ ] Definire coding standard.
* [ ] Definire regole per smart pointer.
* [ ] Definire regole per error handling.
* [ ] Definire regole per threading.
* [ ] Definire regole per allocazioni durante il frame.

---

# 13. Threading e concorrenza

## P0

* [ ] Definire il main thread.
* [ ] Eseguire rendering sul thread corretto.
* [ ] Eseguire operazioni GPU sul thread corretto.
* [ ] Non caricare texture dal thread sbagliato.
* [ ] Non distruggere texture dal thread sbagliato.
* [ ] Non modificare la scena simultaneamente da più thread.
* [ ] Non modificare il registry degli asset senza sincronizzazione.
* [ ] Non modificare prefab condivisi senza sincronizzazione.
* [ ] Usare code thread-safe.
* [ ] Definire ownership dei job.
* [ ] Supportare cancellazione.
* [ ] Impedire che un job completi su un progetto chiuso.
* [ ] Impedire che un job completi su una scena chiusa.
* [ ] Impedire aggiornamenti UI obsoleti.
* [ ] Evitare deadlock.
* [ ] Evitare lock inversion.
* [ ] Evitare attese infinite.
* [ ] Applicare timeout dove necessario.
* [ ] Garantire shutdown controllato.
* [ ] Attendere o annullare i job prima della distruzione.
* [ ] Non catturare riferimenti non validi nelle lambda asincrone.
* [ ] Usare snapshot immutabili per dati letti in background.
* [ ] Accodare sul main thread le modifiche alla scena.

## P1

* [ ] Spostare importazioni in background.
* [ ] Spostare indicizzazione in background.
* [ ] Spostare generazione preview in background.
* [ ] Spostare build in background.
* [ ] Mostrare progresso reale.
* [ ] Permettere annullamento.
* [ ] Testare chiusura durante job.
* [ ] Testare cambio progetto durante job.
* [ ] Testare riapertura durante job.
* [ ] Registrare job bloccati.
* [ ] Limitare il numero di job simultanei.
* [ ] Evitare starvation.
* [ ] Dare priorità ai job interattivi.
* [ ] Misurare durata e coda.

---

# 14. Renderer Raylib

## P0

* [ ] Gestire ownership delle texture.
* [ ] Gestire ownership degli shader.
* [ ] Gestire ownership delle render texture.
* [ ] Gestire ownership dei font.
* [ ] Evitare doppio unload.
* [ ] Evitare utilizzo dopo unload.
* [ ] Fornire asset fallback.
* [ ] Non arrestare il runtime per una texture mancante.
* [ ] Non arrestare l'editor per un asset corrotto.
* [ ] Imporre dimensioni massime alle texture.
* [ ] Gestire immagini con dimensioni zero.
* [ ] Gestire immagini enormi.
* [ ] Gestire formati non supportati.
* [ ] Separare coordinate mondo e schermo.
* [ ] Separare viewport e finestra.
* [ ] Gestire resize.
* [ ] Gestire fullscreen.
* [ ] Gestire ritorno da fullscreen.
* [ ] Gestire HiDPI.
* [ ] Gestire scale frazionarie.
* [ ] Gestire pixel-perfect scaling.
* [ ] Evitare texture bleeding.
* [ ] Definire ordine dei layer.
* [ ] Rendere l'ordine deterministico.
* [ ] Gestire z-index uguali.
* [ ] Gestire entità distrutte durante il frame.
* [ ] Non allocare eccessivamente durante il rendering.
* [ ] Non caricare asset durante una draw call.
* [ ] Non bloccare il frame per operazioni I/O.
* [ ] Ripristinare lo stato grafico dopo operazioni personalizzate.
* [ ] Gestire correttamente scissor e viewport.

## P1

* [ ] Implementare batching quando utile.
* [ ] Implementare caching controllato.
* [ ] Implementare reload asset.
* [ ] Monitorare memoria texture.
* [ ] Monitorare draw call.
* [ ] Monitorare cambi shader.
* [ ] Monitorare cambi texture.
* [ ] Aggiungere debug overlay.
* [ ] Mostrare FPS.
* [ ] Mostrare frame time.
* [ ] Mostrare memoria stimata.
* [ ] Mostrare bounding box.
* [ ] Mostrare pivot.
* [ ] Mostrare collider.
* [ ] Mostrare camera.
* [ ] Implementare culling.
* [ ] Testare migliaia di sprite.
* [ ] Testare atlas grandi.
* [ ] Testare molte render texture.
* [ ] Testare finestre ridimensionate frequentemente.

---

# 15. Fisica 2D custom

## P0 — Timestep e ciclo fisico

* [ ] Usare fixed timestep.
* [ ] Separare fisica e rendering.
* [ ] Accumulare tempo residuo.
* [ ] Limitare il numero di step.
* [ ] Evitare la spirale della morte.
* [ ] Gestire frame molto lenti.
* [ ] Gestire pause.
* [ ] Definire se la fisica continua durante la pausa.
* [ ] Rendere coerente il comportamento con TimeManager.
* [ ] Definire il comportamento dello slow motion.
* [ ] Definire il comportamento con time scale zero.
* [ ] Documentare le unità.
* [ ] Definire rapporto pixel-unità fisiche.
* [ ] Separare trasformazione visuale e fisica.
* [ ] Definire chi guida la trasformazione.
* [ ] Interpolare il rendering quando necessario.
* [ ] Non utilizzare direttamente il delta variabile per la simulazione.

## P0 — Corpi e collider

* [ ] Definire corpi statici.
* [ ] Definire corpi dinamici.
* [ ] Definire corpi cinematici.
* [ ] Definire trigger.
* [ ] Definire collider solidi.
* [ ] Definire layer di collisione.
* [ ] Definire mask.
* [ ] Definire start, stay ed end.
* [ ] Gestire distruzione durante collisione.
* [ ] Gestire disabilitazione durante collisione.
* [ ] Gestire cambio scena durante collisione.
* [ ] Impedire accesso a collider invalidi.
* [ ] Accodare modifiche strutturali.
* [ ] Gestire collider inizialmente sovrapposti.
* [ ] Definire comportamento dei collider senza corpo.
* [ ] Definire comportamento dei collider figli.

## P0 — Stabilità numerica

* [ ] Gestire `NaN`.
* [ ] Gestire infinito.
* [ ] Gestire masse zero.
* [ ] Gestire masse negative.
* [ ] Gestire scale zero.
* [ ] Gestire scale negative.
* [ ] Gestire collider degeneri.
* [ ] Gestire vettori nulli.
* [ ] Evitare normalizzazione di vettori nulli.
* [ ] Applicare epsilon coerenti.
* [ ] Limitare velocità eccessive.
* [ ] Limitare posizioni fuori scala.
* [ ] Limitare accelerazioni fuori scala.
* [ ] Validare ogni proprietà fisica.
* [ ] Impedire valori non finiti provenienti da Lua.
* [ ] Impedire valori non finiti provenienti dalla Logic Board.
* [ ] Testare delta estremi.
* [ ] Testare oggetti molto piccoli.
* [ ] Testare oggetti molto grandi.

## P1 — Collision detection e response

* [ ] Separare broad phase e narrow phase.
* [ ] Implementare AABB-AABB.
* [ ] Implementare circle-circle.
* [ ] Implementare AABB-circle.
* [ ] Implementare point test.
* [ ] Implementare overlap query.
* [ ] Implementare raycast.
* [ ] Risolvere penetrazioni.
* [ ] Gestire impulso.
* [ ] Gestire restituzione.
* [ ] Gestire attrito.
* [ ] Gestire gravità.
* [ ] Gestire damping.
* [ ] Gestire sleep.
* [ ] Gestire wake.
* [ ] Valutare CCD.
* [ ] Gestire proiettili veloci.
* [ ] Rendere deterministico l'ordine dei contatti.
* [ ] Evitare dipendenza dall'ordine dei container.
* [ ] Testare stacking.
* [ ] Testare collisioni multiple.
* [ ] Testare tunnel.
* [ ] Testare angoli e bordi.
* [ ] Testare grandi quantità di collider.

## P2

* [ ] Joint.
* [ ] One-way platform.
* [ ] Slope handling.
* [ ] Character controller.
* [ ] Materiali fisici.
* [ ] Sensori avanzati.
* [ ] Profiler collisioni.
* [ ] Debug draw completo.
* [ ] Replay deterministico.
* [ ] Test di stabilità prolungati.

---

# 16. Input

## P0

* [ ] Distinguere `Pressed`.
* [ ] Distinguere `Held`.
* [ ] Distinguere `Released`.
* [ ] Aggiornare lo stato precedente una sola volta per frame.
* [ ] Definire il punto preciso del frame in cui l'input viene aggiornato.
* [ ] Evitare doppio aggiornamento.
* [ ] Gestire perdita del focus.
* [ ] Resettare tasti bloccati dopo perdita del focus.
* [ ] Gestire layout tastiera differenti.
* [ ] Gestire mouse fuori dalla finestra.
* [ ] Gestire coordinate con zoom.
* [ ] Gestire coordinate con viewport.
* [ ] Gestire coordinate con camera.
* [ ] Impedire che l'input dell'editor raggiunga il runtime preview.
* [ ] Definire priorità tra UI, editor e gioco.
* [ ] Definire input consumption.
* [ ] Non eseguire azioni gameplay mentre si scrive in un campo testuale.
* [ ] Gestire combinazioni di tasti.
* [ ] Gestire ripetizione tastiera.
* [ ] Separare repeat da press.
* [ ] Gestire perdita e riconnessione gamepad.
* [ ] Gestire gamepad non supportati.
* [ ] Definire dead zone.

## P1

* [ ] Action mapping.
* [ ] Rebinding.
* [ ] Più profili input.
* [ ] Più controller.
* [ ] Supportare gamepad multipli.
* [ ] Supportare inversione assi.
* [ ] Supportare sensibilità.
* [ ] Registrare input.
* [ ] Riprodurre input per test.
* [ ] Testare trigger Logic Board.
* [ ] Testare input simultanei.
* [ ] Testare focus tra pannelli.
* [ ] Testare shortcut editor.

# 17. Scene, entità, componenti e prefab

## P0 — Entità e scene

* [ ] Ogni entità deve avere un ID univoco.
* [ ] Ogni scena deve avere un ID univoco.
* [ ] Ogni prefab deve avere un ID univoco.
* [ ] Gli ID devono essere persistenti.
* [ ] Gli ID non devono dipendere dal nome.
* [ ] Gli ID non devono cambiare dopo una rinomina.
* [ ] Validare ogni riferimento.
* [ ] Invalidare i riferimenti dopo la distruzione.
* [ ] Usare distruzione differita quando necessario.
* [ ] Non modificare container durante iterazioni non sicure.
* [ ] Definire `onCreate`.
* [ ] Definire `onStart`.
* [ ] Definire `onTick`.
* [ ] Definire `onDestroy`.
* [ ] Definire l'ordine tra componenti.
* [ ] Definire l'ordine tra entità.
* [ ] Definire il comportamento del cambio scena.
* [ ] Impedire callback della scena precedente.
* [ ] Rendere il caricamento transazionale.
* [ ] Validare la nuova scena prima di sostituire la corrente.
* [ ] Mantenere la scena corrente se il caricamento fallisce.
* [ ] Gestire asset mancanti.
* [ ] Pulire tutte le risorse della scena.
* [ ] Non lasciare listener della scena precedente.
* [ ] Non lasciare timer della scena precedente.
* [ ] Non lasciare coroutine della scena precedente.
* [ ] Non lasciare handle della scena precedente.
* [ ] Evitare entità duplicate con lo stesso ID.
* [ ] Evitare componenti incompatibili.
* [ ] Validare dipendenze tra componenti.
* [ ] Evitare componenti duplicati quando non consentiti.

## P0 — Nomi univoci dei prefab

* [ ] Non permettere la creazione di un prefab con un nome già utilizzato nello stesso progetto o namespace.
* [ ] Non permettere la duplicazione di un prefab se il nome risultante è già utilizzato.
* [ ] Non permettere la rinomina di un prefab con un nome già utilizzato.
* [ ] Non permettere l'importazione di un prefab con un nome già utilizzato.
* [ ] Non permettere la migrazione di prefab che produca nomi duplicati senza risoluzione esplicita.
* [ ] Non permettere la generazione automatica di prefab con un nome già utilizzato.
* [ ] Applicare il controllo sia nella UI sia nel core C++.
* [ ] Considerare il controllo del core come autoritativo.
* [ ] Non affidarsi esclusivamente alla validazione React.
* [ ] Normalizzare il nome prima del confronto.
* [ ] Rimuovere spazi iniziali.
* [ ] Rimuovere spazi finali.
* [ ] Normalizzare sequenze di spazi quando previsto.
* [ ] Applicare normalizzazione Unicode coerente.
* [ ] Applicare confronto case-insensitive.
* [ ] Considerare equivalenti nomi come `Player`, `player` e `Player`.
* [ ] Definire chiaramente lo scope di unicità.
* [ ] Stabilire se l'unicità vale per progetto, cartella o namespace.
* [ ] Usare una regola coerente su Windows, Linux e macOS.
* [ ] Mostrare un errore chiaro.
* [ ] Indicare quale prefab utilizza già il nome.
* [ ] Non modificare automaticamente il nome senza informare l'utente.
* [ ] Proporre un nome alternativo.
* [ ] Generare alternative come `Player_2`, `Player_3` e successive.
* [ ] Verificare nuovamente l'unicità dell'alternativa.
* [ ] Impedire race condition durante creazioni simultanee.
* [ ] Rendere atomica la registrazione del nome.
* [ ] Conservare un indice dei nomi normalizzati.
* [ ] Ricostruire e validare l'indice all'apertura del progetto.
* [ ] Rilevare eventuali duplicati presenti in vecchi progetti.
* [ ] Richiedere una risoluzione esplicita dei duplicati durante la migrazione.
* [ ] Non usare il nome come riferimento tecnico principale.
* [ ] Utilizzare sempre l'ID univoco interno.
* [ ] Aggiornare i riferimenti per ID, non per nome.
* [ ] Non rompere i riferimenti quando il prefab viene rinominato.

## P0 — Regole generali per i nomi

* [ ] Definire lunghezza minima.
* [ ] Definire lunghezza massima.
* [ ] Rifiutare nomi vuoti.
* [ ] Rifiutare nomi composti soltanto da spazi.
* [ ] Rifiutare caratteri non supportati quando necessario.
* [ ] Rifiutare nomi riservati.
* [ ] Rifiutare nomi incompatibili con il filesystem se usati nei file.
* [ ] Evitare collisioni tra nomi visualmente equivalenti.
* [ ] Separare nome visuale e nome file.
* [ ] Separare nome visuale e identificatore Lua.
* [ ] Generare identificatori Lua validi senza usare direttamente il nome.
* [ ] Conservare il nome originale soltanto come metadato leggibile.

## P1 — Prefab

* [ ] Versionare i prefab.
* [ ] Supportare override espliciti.
* [ ] Distinguere proprietà ereditate e sovrascritte.
* [ ] Rilevare riferimenti prefab rotti.
* [ ] Rilevare prefab mancanti.
* [ ] Rilevare dipendenze circolari.
* [ ] Impedire prefab ricorsivi non supportati.
* [ ] Mostrare le istanze di un prefab.
* [ ] Mostrare gli oggetti che dipendono da un prefab.
* [ ] Mostrare le conseguenze prima dell'eliminazione.
* [ ] Impedire eliminazione se provoca riferimenti non risolti, salvo conferma.
* [ ] Supportare sostituzione di un prefab.
* [ ] Aggiornare le istanze in modo deterministico.
* [ ] Non sovrascrivere override locali.
* [ ] Prevedere rollback degli aggiornamenti.
* [ ] Testare prefab annidati.
* [ ] Testare rinomina.
* [ ] Testare duplicazione.
* [ ] Testare importazione.
* [ ] Testare migrazione.
* [ ] Testare nomi Unicode.
* [ ] Testare collisioni case-insensitive.

---

# 18. Asset pipeline

## P0

* [ ] Validare ogni file.
* [ ] Non fidarsi dell'estensione.
* [ ] Verificare il formato reale.
* [ ] Imporre limiti di dimensione.
* [ ] Imporre limiti di memoria.
* [ ] Gestire decoder falliti.
* [ ] Gestire file corrotti.
* [ ] Gestire file troncati.
* [ ] Gestire archivi.
* [ ] Bloccare path traversal negli archivi.
* [ ] Proteggersi da archive bomb.
* [ ] Limitare il numero di file estratti.
* [ ] Limitare la profondità degli archivi.
* [ ] Non sovrascrivere asset senza conferma.
* [ ] Generare ID indipendenti dal nome.
* [ ] Mantenere riferimenti dopo rinomina.
* [ ] Rilevare eliminazioni esterne.
* [ ] Rilevare modifiche esterne.
* [ ] Mostrare placeholder per asset mancanti.
* [ ] Separare sorgente e cache.
* [ ] Rendere la cache rigenerabile.
* [ ] Non trattare la cache come dato essenziale.
* [ ] Validare metadati.
* [ ] Versionare metadati.
* [ ] Gestire importazioni duplicate.
* [ ] Gestire nomi duplicati.
* [ ] Evitare collisioni su filesystem case-insensitive.
* [ ] Evitare esecuzione automatica di file importati.
* [ ] Non caricare librerie native da asset.
* [ ] Non aprire automaticamente URL contenuti negli asset.
* [ ] Non eseguire script importati senza consenso.

## P1

* [ ] Import asincrono.
* [ ] Reimport automatico.
* [ ] Cache tramite hash.
* [ ] Preview in background.
* [ ] Dipendenze tra asset.
* [ ] Rilevamento asset inutilizzati.
* [ ] Pulizia sicura cache.
* [ ] Statistiche dimensione.
* [ ] Statistiche memoria.
* [ ] Mostrare progresso.
* [ ] Permettere annullamento.
* [ ] Supportare operazioni batch.
* [ ] Gestire conflitti.
* [ ] Mostrare differenze di importazione.
* [ ] Conservare impostazioni di importazione.
* [ ] Reimportare in modo deterministico.
* [ ] Testare migliaia di asset.
* [ ] Testare asset con nomi lunghi.
* [ ] Testare asset Unicode.
* [ ] Testare asset identici.
* [ ] Testare modifiche simultanee.

---

# 19. Gestione degli errori

## P0

* [ ] Nessun fallimento silenzioso nelle operazioni importanti.
* [ ] Ogni errore deve avere categoria.
* [ ] Ogni errore deve avere codice.
* [ ] Ogni errore deve avere messaggio.
* [ ] Ogni errore deve avere contesto.
* [ ] Separare errori recuperabili e irreversibili.
* [ ] Evitare crash causati da file utente.
* [ ] Evitare crash causati da script utente.
* [ ] Evitare crash causati da Logic Board utente.
* [ ] Mostrare messaggi comprensibili.
* [ ] Conservare dettagli tecnici nei log.
* [ ] Non mostrare stack trace grezzi all'utente normale.
* [ ] Non inserire segreti nei log.
* [ ] Non inserire contenuti completi del progetto nei log.
* [ ] Gestire errori Raylib.
* [ ] Gestire errori Lua.
* [ ] Gestire errori filesystem.
* [ ] Gestire errori serializzazione.
* [ ] Gestire errori bridge.
* [ ] Gestire errori importazione.
* [ ] Gestire errori esportazione.
* [ ] Gestire errori fisica.
* [ ] Gestire errori del compilatore Logic Board.
* [ ] Evitare catene di errori duplicate.
* [ ] Evitare finestre di errore infinite.
* [ ] Evitare che un errore secondario nasconda quello originale.
* [ ] Conservare la causa originaria.
* [ ] Mostrare azioni possibili.
* [ ] Non modificare dati dopo un errore parziale senza rollback.

## P1

* [ ] Definire codici stabili.
* [ ] Aggiungere suggerimenti correttivi.
* [ ] Permettere copia del report.
* [ ] Collegare errori alle regole.
* [ ] Collegare errori agli asset.
* [ ] Collegare errori ai prefab.
* [ ] Collegare errori alle scene.
* [ ] Registrare breadcrumb.
* [ ] Implementare crash handler.
* [ ] Recuperare il progetto.
* [ ] Permettere avvio in safe mode.
* [ ] Raggruppare errori ripetitivi.
* [ ] Limitare spam nella console.
* [ ] Mostrare conteggio degli errori.
* [ ] Permettere filtri.

---

# 20. Logging, diagnostica e profiling

## P0

* [ ] Log separati per editor e runtime.
* [ ] Livelli `debug`, `info`, `warning`, `error`, `fatal`.
* [ ] Timestamp.
* [ ] Nome sottosistema.
* [ ] Versione ArtCade.
* [ ] Versione progetto.
* [ ] Identificatore sessione.
* [ ] Rotazione dei log.
* [ ] Limite dimensione.
* [ ] Limite numero file.
* [ ] Nessun token.
* [ ] Nessuna password.
* [ ] Nessun percorso sensibile non necessario.
* [ ] Nessun contenuto completo di script senza consenso.
* [ ] Flush degli errori critici.
* [ ] Gestire fallimento della scrittura dei log.
* [ ] Non bloccare il frame per logging eccessivo.

## P1

* [ ] Profiler frame.
* [ ] Profiler Lua.
* [ ] Profiler Logic Board.
* [ ] Profiler fisica.
* [ ] Profiler rendering.
* [ ] Profiler asset.
* [ ] Conteggio entità.
* [ ] Conteggio componenti.
* [ ] Conteggio prefab.
* [ ] Conteggio draw call.
* [ ] Conteggio eventi.
* [ ] Memoria asset.
* [ ] Memoria Lua.
* [ ] Memoria fisica.
* [ ] Tempo caricamento scene.
* [ ] Tempo salvataggio.
* [ ] Tempo compilazione.
* [ ] Tempo esportazione.
* [ ] Esportazione report diagnostico.
* [ ] Modalità diagnostica.
* [ ] Grafico frame time.
* [ ] Percentili frame time.
* [ ] Individuazione spike.
* [ ] Individuazione allocazioni per frame.
* [ ] Individuazione script lenti.
* [ ] Individuazione regole lente.

# 21. Test automatici

## P0 — Unit test

* [ ] Matematica vettoriale.
* [ ] Collisioni.
* [ ] Risoluzione fisica.
* [ ] Handle.
* [ ] Lifetime.
* [ ] Serializzazione.
* [ ] Deserializzazione.
* [ ] Validazione.
* [ ] Migrazioni.
* [ ] EventBus.
* [ ] Scene loading.
* [ ] Scene unloading.
* [ ] Input states.
* [ ] Compilatore Logic Board.
* [ ] API Lua.
* [ ] Sandbox Lua.
* [ ] Asset registry.
* [ ] Path validation.
* [ ] Nome prefab normalizzato.
* [ ] Unicità dei prefab.
* [ ] Duplicazione prefab.
* [ ] Rinomina prefab.
* [ ] Importazione prefab.
* [ ] Generazione automatica del nome alternativo.
* [ ] Gestione nomi Unicode.
* [ ] Gestione confronto case-insensitive.
* [ ] Gestione nomi con spazi.
* [ ] Gestione ID duplicati.

## P0 — Integration test

* [ ] React → Tauri → C++.
* [ ] Apertura progetto.
* [ ] Modifica progetto.
* [ ] Salvataggio.
* [ ] Chiusura.
* [ ] Riapertura.
* [ ] Migrazione.
* [ ] Compilazione Logic Board.
* [ ] Avvio runtime.
* [ ] Errore Lua.
* [ ] Importazione asset.
* [ ] Cambio scena.
* [ ] Crash recovery.
* [ ] Creazione prefab.
* [ ] Duplicazione prefab.
* [ ] Rinomina prefab.
* [ ] Eliminazione prefab.
* [ ] Aggiornamento istanze.
* [ ] Collisione tra nomi.
* [ ] Concorrenza nella creazione.
* [ ] Scrittura atomica.
* [ ] Build esportata.
* [ ] Avvio della build esportata.

## P1 — Test avanzati

* [ ] Golden test dei progetti.
* [ ] Golden test delle scene.
* [ ] Golden test dei prefab.
* [ ] Golden test del Lua.
* [ ] Fuzzing parser progetto.
* [ ] Fuzzing parser scena.
* [ ] Fuzzing parser prefab.
* [ ] Fuzzing asset.
* [ ] Fuzzing bridge.
* [ ] Property-based test fisica.
* [ ] Input casuali.
* [ ] Test di carico.
* [ ] Test di durata.
* [ ] Test apertura/chiusura ripetuta.
* [ ] Test creazione/distruzione entità.
* [ ] Test migliaia di prefab.
* [ ] Test migliaia di asset.
* [ ] Test migliaia di regole.
* [ ] Test hot reload ripetuto.
* [ ] Test crash durante salvataggio.
* [ ] Test crash durante importazione.
* [ ] Test crash durante migrazione.
* [ ] Test memoria insufficiente.
* [ ] Test disco pieno.
* [ ] Test permessi mancanti.

---

# 22. Prestazioni e scalability locale

## P0 — Budget misurabili

* [ ] Definire tempo massimo di apertura progetto.
* [ ] Definire tempo massimo di caricamento scena.
* [ ] Definire tempo massimo di compilazione Logic Board.
* [ ] Definire tempo massimo di salvataggio.
* [ ] Definire tempo massimo di importazione.
* [ ] Definire tempo massimo di esportazione.
* [ ] Definire frame time del runtime.
* [ ] Definire frame time dell'editor.
* [ ] Definire memoria massima.
* [ ] Definire numero entità supportate.
* [ ] Definire numero componenti supportati.
* [ ] Definire numero prefab supportati.
* [ ] Definire numero regole supportate.
* [ ] Definire eventi massimi per frame.
* [ ] Definire asset massimi indicizzabili.
* [ ] Definire texture massime caricabili.
* [ ] Definire tempo massimo di risposta UI.

## P1 — Scenari minimi

* [ ] 1.000 entità.
* [ ] 10.000 entità semplici.
* [ ] 1.000 collider.
* [ ] 10.000 collider broad-phase.
* [ ] 1.000 prefab.
* [ ] 10.000 regole semplici.
* [ ] 1.000 eventi input.
* [ ] Centinaia di texture.
* [ ] Migliaia di asset.
* [ ] Progetto attivo per diverse ore.
* [ ] Cambi scena ripetuti.
* [ ] Hot reload ripetuti.
* [ ] Importazioni multiple.
* [ ] Salvataggi ripetuti.
* [ ] Undo/redo prolungato.
* [ ] Generazione massiva di entità da prefab.

## Metriche obbligatorie

* [ ] FPS medio.
* [ ] Frame time medio.
* [ ] Frame time massimo.
* [ ] Percentile 95.
* [ ] Percentile 99.
* [ ] Allocazioni per frame.
* [ ] Picchi di memoria.
* [ ] Tempo di caricamento.
* [ ] Tempo di serializzazione.
* [ ] Tempo di compilazione.
* [ ] Tempo di importazione.
* [ ] Tempo di aggiornamento prefab.
* [ ] Numero di eventi.
* [ ] Numero di collision pair.
* [ ] Numero di draw call.
* [ ] Tempo Lua.
* [ ] Tempo Logic Board.
* [ ] Tempo fisica.

---

# 23. UX dell'editor e prevenzione degli errori

## P0

* [ ] Nessuna operazione distruttiva senza conferma o undo.
* [ ] Mostrare progetto corrente.
* [ ] Mostrare scena corrente.
* [ ] Mostrare prefab corrente.
* [ ] Mostrare modifiche non salvate.
* [ ] Mostrare stato compilazione Logic Board.
* [ ] Mostrare errori vicino all'elemento.
* [ ] Non fallire silenziosamente.
* [ ] Mostrare progresso.
* [ ] Permettere annullamento.
* [ ] Disabilitare azioni non valide.
* [ ] Impedire esecuzione con errori bloccanti.
* [ ] Distinguere errori e warning.
* [ ] Navigare dall'errore all'elemento.
* [ ] Mostrare conflitti di nomi prefab immediatamente.
* [ ] Non consentire conferma con nome prefab duplicato.
* [ ] Evidenziare il prefab già esistente.
* [ ] Proporre un nome alternativo.
* [ ] Non applicare il nome alternativo senza scelta dell'utente.
* [ ] Mostrare conseguenze prima di eliminare asset o prefab.
* [ ] Mostrare dipendenze.
* [ ] Proteggere da click multipli.
* [ ] Proteggere da invii multipli.
* [ ] Non avviare due operazioni incompatibili.
* [ ] Mostrare stato occupato.
* [ ] Mostrare errori di salvataggio in modo persistente.

## P1

* [ ] Shortcut coerenti.
* [ ] Undo/redo prevedibile.
* [ ] Ricerca globale.
* [ ] Filtri Logic Board.
* [ ] Ricerca riferimenti.
* [ ] Ricerca prefab.
* [ ] Ricerca asset.
* [ ] Ricerca entità.
* [ ] Layout ripristinabile.
* [ ] Reset UI.
* [ ] Supporto HiDPI.
* [ ] Navigazione tastiera.
* [ ] Contrasto adeguato.
* [ ] Focus visibile.
* [ ] Tooltips.
* [ ] Messaggi di validazione in tempo reale.
* [ ] Non cancellare input non valido.
* [ ] Consentire correzione.
* [ ] Mostrare nomi e ID quando utile.
* [ ] Supportare copia dei riferimenti.
* [ ] Supportare selezione dell'elemento dipendente.

---

# 24. Build ed esportazione dei giochi

## P0

* [ ] Usare un processo controllato.
* [ ] Non usare comandi shell arbitrari.
* [ ] Verificare dipendenze.
* [ ] Verificare progetto.
* [ ] Verificare scene.
* [ ] Verificare prefab.
* [ ] Verificare Logic Board.
* [ ] Verificare script Lua.
* [ ] Verificare asset.
* [ ] Usare directory output isolata.
* [ ] Pulire output in sicurezza.
* [ ] Non includere file dell'editor.
* [ ] Non includere sorgenti del progetto per errore.
* [ ] Non includere token.
* [ ] Non includere percorsi assoluti.
* [ ] Fallire su errori bloccanti.
* [ ] Generare log.
* [ ] Ripulire file temporanei.
* [ ] Non sovrascrivere senza conferma.
* [ ] Verificare avvio eseguibile.
* [ ] Verificare presenza asset.
* [ ] Verificare compatibilità runtime.
* [ ] Verificare versione API Lua.
* [ ] Verificare versione Logic Board.
* [ ] Verificare checksum quando utile.
* [ ] Non esportare plugin editor.
* [ ] Non esportare cache non necessaria.
* [ ] Non esportare autosave.
* [ ] Non esportare backup.

## P1

* [ ] Build Debug.
* [ ] Build Release.
* [ ] Simboli separati.
* [ ] Build riproducibili.
* [ ] Cache build.
* [ ] Export incrementale.
* [ ] Manifest.
* [ ] Hash asset.
* [ ] Report dipendenze.
* [ ] Preset.
* [ ] Test automatico dell'output.
* [ ] Esecuzione smoke test.
* [ ] Misurazione dimensione build.
* [ ] Segnalazione asset inutilizzati.
* [ ] Segnalazione script inutilizzati.
* [ ] Segnalazione prefab inutilizzati.
* [ ] Segnalazione scene non raggiungibili.

# 25. Distribuzione dell'editor

## P0

* [ ] Firmare installer quando possibile.
* [ ] Verificare integrità pacchetti.
* [ ] Mostrare versione.
* [ ] Separare stable, beta e development.
* [ ] Proteggere progetti durante aggiornamenti.
* [ ] Eseguire backup impostazioni.
* [ ] Supportare rollback.
* [ ] Non eseguire codice scaricato non verificato.
* [ ] Pubblicare release notes.
* [ ] Pubblicare incompatibilità.
* [ ] Testare installazione pulita.
* [ ] Testare aggiornamento.
* [ ] Testare disinstallazione.
* [ ] Non cancellare progetti durante disinstallazione.
* [ ] Non cancellare backup senza conferma.
* [ ] Non richiedere privilegi amministrativi non necessari.
* [ ] Conservare configurazioni utente in directory appropriate.
* [ ] Non scrivere nella directory dell'eseguibile quando non consentito.
* [ ] Verificare aggiornamento interrotto.
* [ ] Verificare rollback dopo aggiornamento fallito.

## P1

* [ ] Testare Windows.
* [ ] Testare Linux.
* [ ] Testare macOS quando supportato.
* [ ] Testare percorsi Unicode.
* [ ] Testare utenti non amministratori.
* [ ] Testare antivirus comuni.
* [ ] Testare installazione offline.
* [ ] Testare aggiornamento offline fallito.
* [ ] Separare rimozione applicazione e dati utente.
* [ ] Offrire opzione per pulire cache.
* [ ] Registrare log di aggiornamento.
* [ ] Verificare spazio disco prima dell'update.

---

# 26. Plugin e modding futuri

## P0

* [ ] Distinguere plugin fidati e non fidati.
* [ ] Non caricare DLL automaticamente.
* [ ] Non caricare librerie native automaticamente.
* [ ] Richiedere consenso.
* [ ] Mostrare autore.
* [ ] Mostrare origine.
* [ ] Mostrare versione.
* [ ] Mostrare permessi.
* [ ] Non consentire installazioni silenziose.
* [ ] Versionare API plugin.
* [ ] Gestire incompatibilità.
* [ ] Impedire crash all'avvio.
* [ ] Supportare safe mode.
* [ ] Registrare plugin responsabile.
* [ ] Consentire disabilitazione.
* [ ] Preferire plugin Lua sandboxed.
* [ ] Separare plugin editor e runtime.
* [ ] Impedire accesso arbitrario al filesystem.
* [ ] Impedire accesso di rete non autorizzato.
* [ ] Impedire esecuzione di processi.
* [ ] Verificare firme quando implementate.
* [ ] Isolare errori.
* [ ] Definire limiti di memoria e tempo.
* [ ] Non consentire override silenzioso delle API core.

## P1

* [ ] Marketplace moderato.
* [ ] Scansione pacchetti.
* [ ] Revoca plugin.
* [ ] Segnalazione plugin.
* [ ] Aggiornamenti controllati.
* [ ] Dipendenze plugin.
* [ ] Risoluzione conflitti.
* [ ] Documentazione API.
* [ ] Permessi granulari.
* [ ] Sandbox per plugin.
* [ ] Telemetria separata e opzionale.

---

# 27. Privacy, telemetria e crash report

## P0

* [ ] Telemetria disattivabile.
* [ ] Informativa chiara.
* [ ] Non inviare contenuti dei progetti.
* [ ] Non inviare script.
* [ ] Non inviare prefab.
* [ ] Non inviare scene.
* [ ] Non inviare asset.
* [ ] Non inviare percorsi completi.
* [ ] Non inviare token.
* [ ] Non inviare dati personali non necessari.
* [ ] Minimizzare i dati.
* [ ] Limitare la conservazione.
* [ ] Consentire eliminazione.
* [ ] Richiedere consenso per crash report contenenti contesto.
* [ ] Mostrare cosa verrà inviato.
* [ ] Consentire revisione del report.
* [ ] Rimuovere identificatori non necessari.
* [ ] Separare metriche anonime e dati account.
* [ ] Proteggere i dati durante il trasferimento.
* [ ] Proteggere i dati conservati.

## P1

* [ ] Definire una privacy policy.
* [ ] Definire retention.
* [ ] Definire finalità.
* [ ] Definire responsabili.
* [ ] Documentare provider esterni.
* [ ] Gestire opt-in e opt-out.
* [ ] Non riattivare telemetria dopo aggiornamenti.
* [ ] Registrare consenso.
* [ ] Consentire esportazione dati account quando applicabile.

---

# 28. Servizi cloud futuri

Questa sezione diventa P0 quando ArtCade introduce account, cloud save, marketplace, collaborazione, AI o sincronizzazione.

## Autenticazione

* [ ] Usare provider affidabili.
* [ ] Proteggere password.
* [ ] Usare token con scadenza.
* [ ] Proteggere refresh token.
* [ ] Revocare sessioni.
* [ ] Supportare logout globale.
* [ ] Proteggere da brute force.
* [ ] Applicare rate limiting.
* [ ] Usare MFA per amministratori.
* [ ] Gestire recupero account.
* [ ] Proteggere cambio email.
* [ ] Proteggere cambio password.
* [ ] Non salvare token nel frontend in modo insicuro.

## Autorizzazione

* [ ] Verificare ownership.
* [ ] Verificare ruoli.
* [ ] Verificare permessi.
* [ ] Non fidarsi degli ID del client.
* [ ] Controllare lato server.
* [ ] Controllare nel database.
* [ ] Separare utenti.
* [ ] Separare team.
* [ ] Separare progetti.
* [ ] Proteggere funzioni admin.
* [ ] Proteggere funzioni a pagamento.
* [ ] Proteggere marketplace.
* [ ] Proteggere contenuti privati.
* [ ] Testare IDOR/BOLA.
* [ ] Testare escalation di privilegi.

## Database

* [ ] RLS su ogni tabella esposta.
* [ ] Policy testate.
* [ ] Nessuna service key nel client.
* [ ] Migrazioni revisionate.
* [ ] Backup.
* [ ] Restore testato.
* [ ] Indici.
* [ ] Evitare N+1.
* [ ] Query con limiti.
* [ ] Paginazione.
* [ ] Transazioni.
* [ ] Vincoli.
* [ ] Unicità lato database.
* [ ] Audit log.
* [ ] Protezione dei dati sensibili.

## API

* [ ] Rate limiting.
* [ ] Quote.
* [ ] Limiti upload.
* [ ] Timeout.
* [ ] Concurrency limit.
* [ ] Idempotenza.
* [ ] Validazione server-side.
* [ ] Logging antiabuso.
* [ ] Budget AI.
* [ ] Budget cloud.
* [ ] Alert costi.
* [ ] Circuit breaker.
* [ ] Retry controllati.
* [ ] Backoff.
* [ ] Protezione webhook.
* [ ] Verifica firme webhook.
* [ ] Nessun segreto nei log.
* [ ] Paginazione.
* [ ] Versionamento API.

# 29. Documentazione tecnica

## P0

* [ ] Descrizione architettura.
* [ ] Diagramma moduli.
* [ ] Regole ownership.
* [ ] Lifecycle scene.
* [ ] Lifecycle entità.
* [ ] Lifecycle componenti.
* [ ] Lifecycle prefab.
* [ ] Lifecycle script.
* [ ] Ordine game loop.
* [ ] Ordine eventi.
* [ ] Formato progetto.
* [ ] Formato scena.
* [ ] Formato prefab.
* [ ] Formato Logic Board.
* [ ] Processo salvataggio.
* [ ] Processo migrazione.
* [ ] Processo build.
* [ ] Processo esportazione.
* [ ] Processo recovery.
* [ ] Politica nomi prefab.
* [ ] Regole normalizzazione nomi.
* [ ] Scope di unicità.
* [ ] Requisiti minimi.
* [ ] Compatibilità piattaforme.
* [ ] Limiti noti.

## P1

* [ ] Guida contributori.
* [ ] Coding standard.
* [ ] Regole review.
* [ ] API Lua.
* [ ] Componenti.
* [ ] Trigger.
* [ ] Condizioni.
* [ ] Azioni.
* [ ] Esempi verificati.
* [ ] Registro decisioni architetturali.
* [ ] Changelog.
* [ ] Guida migrazione.
* [ ] Guida diagnostica.
* [ ] Guida crash recovery.
* [ ] Guida safe mode.
* [ ] Guida performance.
* [ ] Guida sicurezza plugin.

---

# 30. Regole per l'uso dell'AI nello sviluppo

## P0

* [ ] Nessun codice generato integrato senza revisione.
* [ ] Nessuna funzione considerata corretta soltanto perché compila.
* [ ] Verificare ownership.
* [ ] Verificare lifetime.
* [ ] Verificare gestione errori.
* [ ] Verificare input non validi.
* [ ] Verificare filesystem.
* [ ] Verificare threading.
* [ ] Verificare complessità.
* [ ] Verificare allocazioni.
* [ ] Verificare API Lua.
* [ ] Verificare sandbox.
* [ ] Verificare serializzazione.
* [ ] Verificare compatibilità.
* [ ] Richiedere test.
* [ ] Richiedere test negativi.
* [ ] Non accettare soltanto happy path.
* [ ] Non aggiungere dipendenze senza motivazione.
* [ ] Non accettare codice duplicato.
* [ ] Non accettare API inventate.
* [ ] Verificare documentazione ufficiale.
* [ ] Eseguire il codice.
* [ ] Profilare il codice.
* [ ] Testare Release.
* [ ] Verificare i risultati.
* [ ] Non permettere all'AI di modificare formati senza migrazione.
* [ ] Non permettere all'AI di cambiare API pubbliche senza review.
* [ ] Non permettere all'AI di disabilitare controlli per far passare i test.
* [ ] Non permettere all'AI di ignorare errori con catch vuoti.
* [ ] Non permettere all'AI di usare nomi come identificatori stabili.
* [ ] Non permettere all'AI di aggirare il controllo dei nomi prefab.

## Domande obbligatorie in revisione

* [ ] Cosa accade con input vuoto?
* [ ] Cosa accade con input enorme?
* [ ] Cosa accade con file corrotto?
* [ ] Cosa accade se l'operazione viene annullata?
* [ ] Cosa accade se l'entità viene distrutta?
* [ ] Cosa accade se il prefab viene eliminato?
* [ ] Cosa accade se il prefab viene rinominato?
* [ ] Cosa accade se il nome è già utilizzato?
* [ ] Cosa accade con differenze di maiuscole?
* [ ] Cosa accade con spazi iniziali e finali?
* [ ] Cosa accade con Unicode?
* [ ] Cosa accade durante un cambio scena?
* [ ] Cosa accade se il salvataggio fallisce?
* [ ] Cosa accade se il processo termina?
* [ ] Cosa accade con 1.000 elementi?
* [ ] Cosa accade con 10.000 elementi?
* [ ] Cosa accade in Release?
* [ ] Quale thread esegue il codice?
* [ ] Chi possiede la risorsa?
* [ ] Quando viene liberata?
* [ ] Il comportamento è deterministico?
* [ ] Esiste un test?
* [ ] L'errore è visibile?
* [ ] Esiste rollback?
* [ ] I riferimenti restano validi?

---

# 31. Gate di rilascio

## Prima di una alpha privata

* [ ] Salvataggio atomico.
* [ ] Backup.
* [ ] Crash recovery basilare.
* [ ] Validazione progetti.
* [ ] Validazione scene.
* [ ] Validazione prefab.
* [ ] Filesystem confinato.
* [ ] Sandbox Lua minima.
* [ ] Logic Board deterministica.
* [ ] Errori Lua non fatali.
* [ ] Ownership C++ definita.
* [ ] AddressSanitizer senza errori critici.
* [ ] Test serializzazione.
* [ ] Test compilazione.
* [ ] Build esportata avviabile.
* [ ] Nessun segreto.
* [ ] ID univoci.
* [ ] Nomi prefab univoci.
* [ ] Blocco creazione prefab duplicati.
* [ ] Blocco rinomina prefab duplicati.
* [ ] Blocco importazione prefab duplicati.
* [ ] Test normalizzazione nomi.

## Prima di una beta pubblica

* [ ] Tutti i P0 completati.
* [ ] Migrazioni testate.
* [ ] Undo/redo affidabile.
* [ ] Recovery testato.
* [ ] Test di carico.
* [ ] Profiling.
* [ ] Errori comprensibili.
* [ ] Installer affidabile.
* [ ] Aggiornamento.
* [ ] Rollback.
* [ ] Documentazione Lua.
* [ ] Source mapping Logic Board.
* [ ] Test installazione pulita.
* [ ] Test progetti precedenti.
* [ ] Test prefab annidati.
* [ ] Test migliaia di prefab.
* [ ] Test collisioni di nomi.
* [ ] Test concorrenza nella creazione.
* [ ] Test sistemi case-sensitive e case-insensitive.

## Prima della versione 1.0

* [ ] Tutti i P0 completati.
* [ ] Tutti i P1 completati o formalmente esclusi.
* [ ] Nessun crash noto grave.
* [ ] Nessuna perdita dati nota.
* [ ] Nessuna evasione sandbox nota.
* [ ] Nessuna scrittura arbitraria.
* [ ] Formato progetto stabile.
* [ ] Formato prefab stabile.
* [ ] Migrazioni supportate.
* [ ] Performance budget rispettati.
* [ ] Runtime testato per sessioni lunghe.
* [ ] Editor testato per sessioni lunghe.
* [ ] Documentazione completa.
* [ ] Diagnostica completa.
* [ ] Licenze verificate.
* [ ] Build firmate quando possibile.
* [ ] Policy nomi prefab stabile.
* [ ] Nessun duplicato non risolto.
* [ ] Tool di validazione progetto disponibile.
* [ ] Safe mode disponibile.
* [ ] Crash recovery affidabile.

---

# 32. Priorità operative immediate per ArtCade

Ordine consigliato:

1. [ ] Definire i confini tra React, Tauri, core C++ e runtime.
2. [ ] Definire il formato progetto e il relativo versionamento.
3. [ ] Definire il formato scena.
4. [ ] Definire il formato prefab.
5. [ ] Implementare ID univoci e persistenti.
6. [ ] Implementare una policy formale per i nomi dei prefab.
7. [ ] Implementare il controllo autoritativo dei nomi nel core C++.
8. [ ] Implementare normalizzazione e confronto case-insensitive.
9. [ ] Bloccare creazione, duplicazione, rinomina e importazione con nomi duplicati.
10. [ ] Implementare nomi alternativi suggeriti.
11. [ ] Implementare salvataggio atomico.
12. [ ] Implementare backup.
13. [ ] Implementare crash recovery.
14. [ ] Progettare la sandbox Lua.
15. [ ] Definire ownership e handle C++.
16. [ ] Rendere deterministico il compilatore Logic Board.
17. [ ] Creare source mapping tra Logic Board e Lua.
18. [ ] Confinare il filesystem.
19. [ ] Definire fixed timestep.
20. [ ] Attivare sanitizers.
21. [ ] Attivare static analysis.
22. [ ] Creare test automatici.
23. [ ] Creare benchmark con migliaia di entità.
24. [ ] Creare benchmark con migliaia di prefab.
25. [ ] Creare benchmark con migliaia di regole.
26. [ ] Definire release gate automatica nella CI.

---

# Regole fondamentali di ArtCade

## Sicurezza

> Un progetto utente non deve mai poter causare scrittura arbitraria, esecuzione nativa non autorizzata, evasione della sandbox o accesso a risorse esterne non consentite.

## Affidabilità

> Nessuna operazione deve poter causare perdita silenziosa o corruzione irreversibile dei dati.

## Identità degli oggetti

> Scene, entità, prefab e asset devono essere identificati internamente tramite ID persistenti, non tramite nomi.

## Nomi dei prefab

> Non deve essere possibile creare, duplicare, generare, importare o rinominare un prefab utilizzando un nome già presente nello scope di unicità stabilito.

## Determinismo

> Lo stesso progetto, con gli stessi input e la stessa versione del runtime, deve produrre lo stesso comportamento salvo funzionalità esplicitamente non deterministiche.

## Error handling

> Un errore proveniente da un progetto, da uno script o da una Logic Board non deve terminare l'intero editor senza possibilità di diagnosi e recupero.

## Release quality

> Una funzione non è completata quando funziona soltanto nel caso ideale; è completata quando gestisce errori, input non validi, annullamento, rollback, carico e diagnostica.
