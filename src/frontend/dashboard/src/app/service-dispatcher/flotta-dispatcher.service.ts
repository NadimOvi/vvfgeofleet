import { Injectable } from '@angular/core';
import { Observable, Subscription, Subject, of } from "rxjs";

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/catch';
import 'rxjs/add/observable/throw';


import * as moment from 'moment';

import { ParametriGeoFleetWS } from '../shared/model/parametri-geofleet-ws.model';


import { PosizioneMezzo } from '../shared/model/posizione-mezzo.model';
import { PosizioneFlottaService } from '../service-VVFGeoFleet/posizione-flotta.service';
import { PosizioneFlottaServiceFake } from '../service-VVFGeoFleet/posizione-flotta.service.fake';

import { GestioneFiltriService } from '../service-filter/gestione-filtri.service';

//import { VoceFiltro } from "../filtri/voce-filtro.model";

//import { observable } from 'rxjs';
//import { toObservable } from '@angular/forms/src/validators';

// i dati del Dispatcher vengono condivisi in tutta l'applicazione
@Injectable({
  providedIn: 'root'
})
export class FlottaDispatcherService {

  private istanteUltimoAggiornamento: Date;


  private subjectNuovePosizioniMezzo$ = new Subject<PosizioneMezzo[]>();
  private subjectPosizioniMezzoStatoModificato$ = new Subject<PosizioneMezzo[]>();
  private subjectPosizioniMezzoLocalizzazioneModificata$ = new Subject<PosizioneMezzo[]>();

  private subjectReset$ = new Subject<Boolean>();
  
  private subjectIstanteUltimoAggiornamento$ = new Subject<Date>();

  // elenco delle posizioni ricevute
  //private elencoPosizioniMezzo : PosizioneMezzo[] = [];

  // elenco delle posizioni da elaborare, ovvero quelle ricevute dal service e 
  // successive all'ultimo istante di aggiornamento 
  private elencoPosizioniDaElaborare : PosizioneMezzo[] = [];

  // array delle sole Nuove posizioni 
  private elencoPosizioniNuove : PosizioneMezzo[] = [];
  // array delle sole posizioni Modificate
  private elencoPosizioniModificate : PosizioneMezzo[] = [];
  // array delle sole posizioni con localizzazione Modificata
  private elencoPosizioniLocalizzazioneModificata : PosizioneMezzo[] = [];
  // array delle sole posizioni con Stato Modificato
  private elencoPosizioniStatoModificato : PosizioneMezzo[] = [];
  
  // array delle sole posizioni Eliminate
  //private elencoPosizioniEliminate : PosizioneMezzo[] = [];
  // array delle sole posizioni Rientrate
  //private elencoPosizioniRientrate : PosizioneMezzo[] = [];
  
  // dataStore delle posizioni
  private elencoPosizioniMostrate : PosizioneMezzo[] = [];
  // copia del dataStore delle posizioni relative all'aggiornamento precedente
  //private elencoPosizioniMostratePrecedenti : PosizioneMezzo[] = [];

  subscription = new Subscription();

  /*
  private vociFiltroStatiMezzo: VoceFiltro[] = [];
  private vociFiltroSedi: VoceFiltro[] = [];
  private vociFiltroGeneriMezzo: VoceFiltro[] = [];
  private vociFiltroDestinazioneUso: VoceFiltro[] = [];
  */


  constructor(
    private posizioneFlottaService: PosizioneFlottaService,
    private gestioneFiltriService: GestioneFiltriService,
  ) { 

    //console.log('FlottaDispatcherService.constructor()');
  
    // attende di ricevere l'istante dell'ultimo aggiornamento
    this.subscription.add(
      this.posizioneFlottaService.getIstanteUltimoAggiornamento()
      .subscribe( istante => {
          this.istanteUltimoAggiornamento = istante;
          this.subjectIstanteUltimoAggiornamento$.next(this.istanteUltimoAggiornamento);          
        })
      ); 

    // in caso di estrazione dei dati senza limite temporale
    // effettua lo svuotamento dello storage delle posizioni
    this.subscription.add(
      this.posizioneFlottaService.getReset()
        .subscribe( value => 
        { 
          //console.log('FlottaDispatcherService.getReset.subscribe', value);
          if (value) 
          {
            this.elencoPosizioniMostrate = [];
            //this.elencoPosizioniMostratePrecedenti = [];
            this.subjectReset$.next(true);  

          }
        })
      ); 
    
    this.aggiornaSituazioneFlotta();
    /*
    // attende una eventuale modifica dei filtri
    this.subscription.add(
      this.gestioneFiltriService.getFiltriStatiMezzo()
      .subscribe( vocifiltro => {
          //console.log("FlottaDispatcherService, getFiltriStatiMezzo:", vocifiltro);
          this.vociFiltroStatiMezzo = vocifiltro;
          this.impostaPosizioneMezziVisibili(this.elencoPosizioniMostrate);        
          this.subjectPosizioniMezzoStatoModificato$.next(this.elencoPosizioniMostrate);
        })
      );   
    
    this.subscription.add(
      this.gestioneFiltriService.getFiltriSedi()
      .subscribe( vocifiltro => {
          //console.log("FlottaDispatcherService, getFiltriSedi:", vocifiltro);
          this.vociFiltroSedi = vocifiltro;
          this.impostaPosizioneMezziVisibili(this.elencoPosizioniMostrate);          
          this.subjectPosizioniMezzoStatoModificato$.next(this.elencoPosizioniMostrate);
        })
      );   

    this.subscription.add(
      this.gestioneFiltriService.getFiltriGeneriMezzo()
      .subscribe( vocifiltro => {
          //console.log("FlottaDispatcherService, getFiltriGeneriMezzo:", vocifiltro);
          this.vociFiltroGeneriMezzo = vocifiltro;
          this.impostaPosizioneMezziVisibili(this.elencoPosizioniMostrate);                    
          this.subjectPosizioniMezzoStatoModificato$.next(this.elencoPosizioniMostrate);
        })
      );   

    this.subscription.add(
      this.gestioneFiltriService.getFiltriDestinazioneUso()
      .subscribe( vocifiltro => {
          //console.log("FlottaDispatcherService, getFiltriDestinazioneUso:", vocifiltro);
          this.vociFiltroDestinazioneUso = vocifiltro;
          this.impostaPosizioneMezziVisibili(this.elencoPosizioniMostrate);          
          this.subjectPosizioniMezzoStatoModificato$.next(this.elencoPosizioniMostrate);
        })
      );   
    */
          
  }


  public getReset(): Observable<Boolean> {      
    return this.subjectReset$.asObservable();
  }

  public getIstanteUltimoAggiornamento(): 
  Observable<Date> {
    return this.subjectIstanteUltimoAggiornamento$.asObservable();                
  }  

  public getNuovePosizioniFlotta(): 
  Observable<PosizioneMezzo[]> {
    //console.log("FlottaDispatcherService.getNuovePosizioniFlotta()", this.subjectNuovePosizioniMezzo$);
    return this.subjectNuovePosizioniMezzo$.asObservable();
  }

  public getPosizioniFlottaStatoModificato(): 
  Observable<PosizioneMezzo[]> {
    //console.log("FlottaDispatcherService.getPosizioniFlottaStatoModificato()", this.subjectPosizioniMezzoStatoModificato$);
    return this.subjectPosizioniMezzoStatoModificato$.asObservable();
  }
  
  public getPosizioniFlottaLocalizzazioneModificata(): 
  Observable<PosizioneMezzo[]> {
    //console.log("FlottaDispatcherService.getPosizioniFlottaLocalizzazioneModificata()", this.subjectPosizioniMezzoLocalizzazioneModificata$);
    return this.subjectPosizioniMezzoLocalizzazioneModificata$.asObservable();
  }
      
  private aggiornaSituazioneFlotta(): void {

    this.posizioneFlottaService.getPosizioneFlotta().debounceTime(3000)
    .subscribe( posizioni => 
      {
        if (posizioni === null) { return; }
        
        //console.log("FlottaDispatcherService.aggiornaSituazioneFlotta() - posizioni", posizioni);
        //console.log("FlottaDispatcherService.length: ", posizioni.length);

        // ordina in modo Ascendente
        this.elencoPosizioniDaElaborare = posizioni.sort( 
            function(a,b) 
          { var bb : Date = new Date(b.istanteAcquisizione);
            var aa : Date  = new Date(a.istanteAcquisizione);
            return aa>bb ? 1 : aa<bb ? -1 : 0;
          }
        );

        // elabora le posizioni ricevute in modo da attivare i subject specifici
        // delle posizioni Nuove, Modificate e d Eliminate
        this.elaboraPosizioniRicevute();
      
        /*
        // riordina l'elenco aggiornato
        this.elencoPosizioniMostrate = this.elencoPosizioniMostrate.sort( 
          function(a,b) 
          { var bb : Date = new Date(b.istanteAcquisizione);
            var aa : Date  = new Date(a.istanteAcquisizione);
            return aa>bb ? -1 : aa<bb ? 1 : 0;
          }
        );
        */
        
      });


    //console.log(this.elencoPosizioniMezzo.length);
    }


    elaboraPosizioniRicevute(){

      this.elaboraPosizioniNuove();
      this.rimuoviPosizioniElaborate(this.elencoPosizioniNuove);
      this.elaboraPosizioniStatoModificato();
      this.rimuoviPosizioniElaborate(this.elencoPosizioniStatoModificato);
      this.elaboraPosizioniLocalizzazioneModificata();
      this.rimuoviPosizioniElaborate(this.elencoPosizioniLocalizzazioneModificata);

      /*
      var el : PosizioneMezzo[] = this.elaboraPosizioniNonModificate();
      (el.length > 0)?console.log("FlottaDispatcherService.elaboraPosizioniNonModificate() - el", el):null;
      this.rimuoviPosizioniElaborate(el);
      */

      (this.elencoPosizioniDaElaborare.length > 0)?console.log("Errore! Posizioni non elaborate:", this.elencoPosizioniDaElaborare):null;
      /*
      this.elencoPosizioniLocalizzazioneModificata = this.elencoPosizioniLocalizzazioneModificata.concat
        (JSON.parse(JSON.stringify(this.elencoPosizioniDaElaborare)));
      */
      

      // salva l'elenco delle posizioni Mostrate attualmente
      //this.elencoPosizioniMostratePrecedenti = JSON.parse( JSON.stringify(this.elencoPosizioniMostrate));

      // riesegue il setup dei filtri per mostrare eventuali nuovi valori non presenti
      // in precedenza
      this.gestioneFiltriService.setupFiltri(this.elencoPosizioniMostrate);


    }    

    // rimuove dalle posizioni da elaborare quelle Nuove
    rimuoviPosizioniElaborate(elenco : PosizioneMezzo[]) : void {
      elenco.forEach( v => { 
        var k = this.elencoPosizioniDaElaborare.
          findIndex( item => item.codiceMezzo === v.codiceMezzo );
        if (k != -1) { this.elencoPosizioniDaElaborare.splice(k,1); 
       }
       else { console.log("rimuoviPosizioniElaborate() - item non trovato", v, this.elencoPosizioniDaElaborare);}
      })
    }
             
    // individua le Nuove posizioni, ovvero quelle di Mezzi non ancora presenti
    elaboraPosizioniNuove() : void {
      this.elencoPosizioniNuove = JSON.parse( JSON.stringify(this.elencoPosizioniDaElaborare.
        filter( (item) => {
          //var v = this.elencoPosizioniMostratePrecedenti.find( x => item.codiceMezzo == x.codiceMezzo );
          var v = this.elencoPosizioniMostrate.findIndex( x => item.codiceMezzo === x.codiceMezzo );
          if ( v == -1) {
            return item}
          else {return null}  }
         )));

      //(this.elencoPosizioniNuove.length > 0)?console.log("FlottaDispatcherService.elaboraPosizioniNuove() - elencoPosizioniNuove", this.elencoPosizioniNuove):null;


      if (this.elencoPosizioniNuove.length > 0) {
        // aggiunge nel DataStore le Nuove posizioni
        if (this.elencoPosizioniMostrate.length === 0 ) 
          { 
            this.elencoPosizioniMostrate = JSON.parse(JSON.stringify(this.elencoPosizioniNuove));
          }
        else 
          { 
            this.elencoPosizioniMostrate =  JSON.parse(JSON.stringify(
              this.elencoPosizioniMostrate.concat( JSON.parse(JSON.stringify(
              this.elencoPosizioniNuove)))));
          }
    
        //this.impostaPosizioneMezziVisibili(this.elencoPosizioniNuove);

        //(this.elencoPosizioniNuove.length > 0)?console.log(moment().toDate(),"flotta-dispatcher.service - elencoPosizioniNuove", this.elencoPosizioniNuove ):null;

        // restituisce gli array delle posizioni elaborate
        this.subjectNuovePosizioniMezzo$.next(this.elencoPosizioniNuove);
      }
    }


  
    // individua le posizioni con lo stato Modificato
    elaboraPosizioniStatoModificato() : void {
      this.elencoPosizioniStatoModificato = JSON.parse( JSON.stringify(
        this.elencoPosizioniDaElaborare.
          filter( (item) => {
            var kk = this.elencoPosizioniMostrate.findIndex( 
              x => item.codiceMezzo === x.codiceMezzo );                
            if ( kk != -1  
                && item.infoSO115.stato != "0" // se non è arrivata dai TTK
                // && this.elencoPosizioniMostrate[kk].istanteAcquisizione != item.istanteAcquisizione 
                // && this.elencoPosizioniMostrate[kk].infoSO115.stato != item.infoSO115.stato            
                ) {
                  // modifica nel DataStore lo stato variato
                  this.elencoPosizioniMostrate[kk].fonte = item.fonte;
                  this.elencoPosizioniMostrate[kk].istanteAcquisizione = item.istanteAcquisizione;
                  this.elencoPosizioniMostrate[kk].istanteArchiviazione = item.istanteArchiviazione;
                  this.elencoPosizioniMostrate[kk].istanteInvio = item.istanteInvio;
                  this.elencoPosizioniMostrate[kk].infoSO115.stato = item.infoSO115.stato;
              
                  return this.elencoPosizioniMostrate[kk];}
            else {return null;}  }
          )
      ));

  
      //(this.elencoPosizioniStatoModificato.length > 0)?console.log(moment().toDate(),"FlottaDispatcherService.elencoPosizioniStatoModificato() - elencoPosizioniStatoModificato", this.elencoPosizioniStatoModificato):null;

      (this.elencoPosizioniStatoModificato.length > 0)?this.subjectPosizioniMezzoStatoModificato$.next(this.elencoPosizioniStatoModificato):null;
      
      //if (this.elencoPosizioniStatoModificato.length > 0) {
      //  this.impostaPosizioneMezziVisibili(this.elencoPosizioniStatoModificato);
      //}
    }

    elaboraPosizioniNonModificate() : PosizioneMezzo[] {
      return this.elencoPosizioniDaElaborare.
        filter( (item) => {
          //var v = this.elencoPosizioniMostratePrecedenti.find( 
          var v = this.elencoPosizioniMostrate.find( 
            x => item.codiceMezzo === x.codiceMezzo );
          if ( v != null && v === item ) {return item}
          else {return null}
        }
      );  
    }

    // individua le posizioni con istante acquisizione aggiornato
    elaboraPosizioniLocalizzazioneModificata() : void {
      this.elencoPosizioniLocalizzazioneModificata = JSON.parse( JSON.stringify(
        this.elencoPosizioniDaElaborare.
        filter( (item) => {
          //var v = this.elencoPosizioniMostratePrecedenti.find( 
          var kk = this.elencoPosizioniMostrate.findIndex( 
            x => item.codiceMezzo === x.codiceMezzo );                
          if ( kk != -1 
                //&& this.elencoPosizioniMostrate[kk].istanteAcquisizione != item.istanteAcquisizione
            )
              {
                // modifica nel DataStore la posizioni variata ed eventualmente il suo stato
                this.elencoPosizioniMostrate[kk].fonte = item.fonte;
                this.elencoPosizioniMostrate[kk].istanteAcquisizione = item.istanteAcquisizione;
                this.elencoPosizioniMostrate[kk].istanteArchiviazione = item.istanteArchiviazione;
                this.elencoPosizioniMostrate[kk].istanteInvio = item.istanteInvio;
                this.elencoPosizioniMostrate[kk].localizzazione = item.localizzazione;
                if (  item.infoSO115.stato != "0")
                {this.elencoPosizioniMostrate[kk].infoSO115.stato = item.infoSO115.stato; }
                
                return this.elencoPosizioniMostrate[kk];}
          else {return null}  }
        )));
  
      //(this.elencoPosizioniLocalizzazioneModificata.length > 0)?console.log(moment().toDate(),"FlottaDispatcherService.elencoPosizioniLocalizzazioneModificata() - elencoPosizioniLocalizzazioneModificata", this.elencoPosizioniLocalizzazioneModificata):null;

      (this.elencoPosizioniLocalizzazioneModificata.length > 0)?this.subjectPosizioniMezzoLocalizzazioneModificata$.next(this.elencoPosizioniLocalizzazioneModificata):null;


      //if (this.elencoPosizioniLocalizzazioneModificata.length > 0) {
      //  this.impostaPosizioneMezziVisibili(this.elencoPosizioniLocalizzazioneModificata);
      //}
    }

    /*
    elaboraPosizioniStatoModificato() : void {
      this.elencoPosizioniStatoModificato = JSON.parse( JSON.stringify(
        this.elencoPosizioniDaElaborare.
        filter( (item) => {
          //var v = this.elencoPosizioniMostratePrecedenti.find( 
          var v = this.elencoPosizioniMostrate.find( 
            x => item.codiceMezzo == x.codiceMezzo );
          if ( v != null &&
              item.infoSO115.stato != "0" &&  // se non è arrivata dai TTK
              v.istanteAcquisizione != item.istanteAcquisizione &&
              v.infoSO115.stato != item.infoSO115.stato            
              ) {
                // modifica nel DataStore lo stato variato
                
                var kk = this.elencoPosizioniMostrate.findIndex( 
                  x => item.codiceMezzo === x.codiceMezzo );                
                if ( kk != null ) 
                  {                           
                    this.elencoPosizioniMostrate[kk].fonte = item.fonte;
                    this.elencoPosizioniMostrate[kk].istanteAcquisizione = item.istanteAcquisizione;
                    this.elencoPosizioniMostrate[kk].istanteArchiviazione = item.istanteArchiviazione;
                    this.elencoPosizioniMostrate[kk].istanteInvio = item.istanteInvio;
                    this.elencoPosizioniMostrate[kk].infoSO115.stato = item.infoSO115.stato;
                  }
                
                this.elencoPosizioniMostrate[kk].fonte = item.fonte;
                this.elencoPosizioniMostrate[kk].istanteAcquisizione = item.istanteAcquisizione;
                this.elencoPosizioniMostrate[kk].istanteArchiviazione = item.istanteArchiviazione;
                this.elencoPosizioniMostrate[kk].istanteInvio = item.istanteInvio;
                this.elencoPosizioniMostrate[kk].infoSO115.stato = item.infoSO115.stato;
             
                return item}
          else {return null}  }
        )));

    
        (this.elencoPosizioniStatoModificato.length > 0)?console.log("FlottaDispatcherService.elencoPosizioniStatoModificato() - elencoPosizioniStatoModificato", this.elencoPosizioniStatoModificato):null;

        (this.elencoPosizioniStatoModificato.length > 0)?this.subjectPosizioniMezzoStatoModificato$.next(this.elencoPosizioniStatoModificato):null;
        

        //if (this.elencoPosizioniStatoModificato.length > 0) {
        //  this.impostaPosizioneMezziVisibili(this.elencoPosizioniStatoModificato);
        //}

      }
      */

      /*      
      elaboraPosizioniLocalizzazioneModificata() : void {
        this.elencoPosizioniLocalizzazioneModificata = JSON.parse( JSON.stringify(
          this.elencoPosizioniDaElaborare.
          filter( (item) => {
            //var v = this.elencoPosizioniMostratePrecedenti.find( 
            var v = this.elencoPosizioniMostrate.find( 
              x => item.codiceMezzo == x.codiceMezzo );
            if ( v != null &&
                  v.istanteAcquisizione != item.istanteAcquisizione
                  &&
                  (
                    (v.localizzazione.lat != item.localizzazione.lat 
                      || v.localizzazione.lon != item.localizzazione.lon 
                      || v.localizzazione.lat != item.localizzazione.lat 
                      || v.localizzazione.lon != item.localizzazione.lon 
                    ) 
                    || v.infoSO115.stato != item.infoSO115.stato 
                  )
              )
                {
                  // modifica nel DataStore la posizioni variata ed eventualmente il suo stato         
                  var kk = this.elencoPosizioniMostrate.findIndex( 
                    x => item.codiceMezzo === x.codiceMezzo );                
                  if ( kk != null ) 
                    {                           
                      this.elencoPosizioniMostrate[kk].fonte = item.fonte;
                      this.elencoPosizioniMostrate[kk].istanteAcquisizione = item.istanteAcquisizione;
                      this.elencoPosizioniMostrate[kk].istanteArchiviazione = item.istanteArchiviazione;
                      this.elencoPosizioniMostrate[kk].istanteInvio = item.istanteInvio;
                      this.elencoPosizioniMostrate[kk].localizzazione = item.localizzazione;
                      if (  item.infoSO115.stato != "0")
                      {this.elencoPosizioniMostrate[kk].infoSO115.stato = item.infoSO115.stato; }
                    }
                  
                  return item}
            else {return null}  }
          )));

                  
        (this.elencoPosizioniLocalizzazioneModificata.length > 0)?console.log("FlottaDispatcherService.elencoPosizioniLocalizzazioneModificata() - elencoPosizioniLocalizzazioneModificata", this.elencoPosizioniLocalizzazioneModificata):null;
        (this.elencoPosizioniLocalizzazioneModificata.length > 0)?this.subjectPosizioniMezzoLocalizzazioneModificata$.next(this.elencoPosizioniLocalizzazioneModificata):null;


        //if (this.elencoPosizioniLocalizzazioneModificata.length > 0) {
        //  this.impostaPosizioneMezziVisibili(this.elencoPosizioniLocalizzazioneModificata);
        //}
      }
      */

      /*
      // modifica nel DataStore le posizioni con variazioni
      this.elencoPosizioniDaElaborare.forEach( item => { 
        var v = this.elencoPosizioniMostrate.findIndex( 
          x => item.codiceMezzo === x.codiceMezzo );
        
        if ( v != null ) 
          {           
          // se la posizione ricevuta ha uno stato 'sconosciuto', significa che proviene
          // da un dispositivo che fornisce solo la localizzazione pertanto
          // modifica solo quelle informazioni,
          // altrimenti modifica anche aggiuntive, inviate ad esempio da SO115 e GAC
          if (item.infoSO115.stato != "0")
            { 
              //console.log("stato ok", this.elencoPosizioniMostrate[v] );
              this.elencoPosizioniMostrate[v] = item; 
*/              
              /*
              var vePM = Object.values(this.elencoPosizioniMostrate[v]);
              var vitem = Object.values(item);
              var trovato : boolean = false;
              var ii : number = 0;
              do {
                  if ( vePM[ii] != null && vitem[ii] != null 
                    && vePM[ii].toString() != vitem[ii].toString() ) 
                  {
                    //console.log("item cambiato", vePM.length, vePM[ii], vitem[ii], this.elencoPosizioniMostrate[v], item );
                    this.elencoPosizioniMostrate[v] = item; 
                    trovato = true;
                  }
                  ii++;
              } while ( !trovato && ii < vePM.length)
              */
/*  
            }
          else
            { //console.log("stato 0", this.elencoPosizioniMostrate[v] );
              //console.log(this.elencoPosizioniMostrate[v].infoSO115.stato );
              this.elencoPosizioniMostrate[v].fonte = item.fonte;
              this.elencoPosizioniMostrate[v].classiMezzo = item.classiMezzo;
              this.elencoPosizioniMostrate[v].istanteAcquisizione = item.istanteAcquisizione;
              this.elencoPosizioniMostrate[v].istanteArchiviazione = item.istanteArchiviazione;
              this.elencoPosizioniMostrate[v].istanteInvio = item.istanteInvio;
              this.elencoPosizioniMostrate[v].localizzazione = item.localizzazione;

              //console.log(this.elencoPosizioniMostrate[v].infoSO115.stato );
            }
            
        }    


      } )
 */ 

    /*
    setVisiblePosizioneMezzoSelezionato( posizione: PosizioneMezzo,
       elencoMezziSelezionati: PosizioneMezzo[]) { 
        //var r : boolean ;
        //r = (elencoMezziSelezionati.find( i => i.codiceMezzo === posizione.codiceMezzo) == null) ? false : true;
        if (elencoMezziSelezionati.
              find( i => i.codiceMezzo === posizione.codiceMezzo) != null) 
        {  this.elencoPosizioniMostrate.
          find( i => i.codiceMezzo === posizione.codiceMezzo).visibile = true;
        }
    }

    setVisiblePosizioneMezzo(p: PosizioneMezzo) { 
      var pp : number = this.elencoPosizioniMostrate.
        findIndex( i => i.codiceMezzo === p.codiceMezzo);
      if ( pp != 0)
      { var r : boolean ;
        r = (r? true: this.vociFiltroStatiMezzo.filter( checked => checked.selezionato === true).
          some(filtro => filtro.codice === p.infoSO115.stato )
          && this.vociFiltroSedi.filter( checked => checked.selezionato === true).
          some(filtro => filtro.codice === p.sedeMezzo )
          && this.vociFiltroGeneriMezzo.filter( checked => checked.selezionato === true).
          some(filtro => p.classiMezzo.some( item => item === filtro.codice))
          && this.vociFiltroDestinazioneUso.filter( checked => checked.selezionato === true).
          some(filtro => filtro.codice === p.destinazioneUso )
          );

          this.elencoPosizioniMostrate[pp].visibile = r;
      }
    }
    */

    /*
    private impostaPosizioneMezziVisibili(elenco: PosizioneMezzo[]): void  { 
      if (this.vociFiltroStatiMezzo.length > 0 && this.vociFiltroSedi.length > 0  
        && this.vociFiltroGeneriMezzo.length > 0 && this.vociFiltroDestinazioneUso.length > 0 )
       { elenco.forEach( p  => this.setVisiblePosizioneMezzo(p) ); }
      
    }
    */



  }
