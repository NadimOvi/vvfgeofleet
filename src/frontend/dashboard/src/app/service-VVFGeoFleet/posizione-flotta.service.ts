
import { Injectable } from '@angular/core';
import { Observable, Subscription, Subject, of } from "rxjs";

import { catchError, retry, map, filter } from 'rxjs/operators';

import * as moment from 'moment';

import { Http, Response, RequestOptions, Headers, RequestMethod  } from '@angular/http';

//import { HttpClient, HttpHeaders, HttpClientModule, HttpResponse } from '@angular/common/http';

import { ParametriGeoFleetWS } from '../shared/model/parametri-geofleet-ws.model';
import { Opzioni } from '../shared/model/opzioni.model';

import { GestioneParametriService } from '../service-parametri/gestione-parametri.service';
import { GestioneOpzioniService } from '../service-opzioni/gestione-opzioni.service';

import { PosizioneMezzo } from '../shared/model/posizione-mezzo.model';
import { RispostaMezziInRettangolo } from '../shared/model/risultati-mezzi-in-rettangolo.model';

import { environment } from "../../environments/environment";

const API_URL = environment.apiUrl;

let headers = new Headers();
headers.append( 'Access-Control-Allow-Origin', '*' ); 
//headers.append( 'Access-Control-Allow-Origin', '*' ); 
//let options = new RequestOptions( { headers:  headers },  method: RequestMethod.Get);
let options = new RequestOptions( { headers:  headers , method: RequestMethod.Get });



@Injectable()
export class PosizioneFlottaService {

  private timer;
  private timerSubcribe: PushSubscription;
  
  private istanteUltimoAggiornamento: Date;
  private istanteAggiornamentoPrecedente: Date = null;

  private maxIstanteAcquisizione: Date;
  private maxIstanteAcquisizionePrecedente: Date = null;

  private trimSec: Number = 0;


  private defaultAttSec: Number = 259200; // 3 giorni (3 * 24 * 60 * 60)
  private defaultrichiestaAPI: string = 'posizioneFlotta';

  private parametriGeoFleetWS : ParametriGeoFleetWS;
  private parametriGeoFleetWSprecedenti: ParametriGeoFleetWS;
  private opzioni : Opzioni;

  private elencoPosizioni: PosizioneMezzo[] = [];
  private obsPosizioniMezzo$ : Observable<PosizioneMezzo[]> ;
  private subjectPosizioniMezzo$ = new Subject<PosizioneMezzo[]>() ;

  private rispostaURL : Observable<Response> ;
  private subjectIstanteUltimoAggiornamento$ = new Subject<Date>();

  private subjectReset$ = new Subject<Boolean>();

  subscription = new Subscription();
  
    constructor(private http: Http,
      private gestioneParametriService: GestioneParametriService,
      private gestioneOpzioniService: GestioneOpzioniService
    ) { 

      // schedula con un timer che si attiva ogni 9 secondi
      this.timer = Observable.timer(0,9000).timeout(120000);


      this.parametriGeoFleetWS = new ParametriGeoFleetWS();
      this.parametriGeoFleetWS.reset();

      this.parametriGeoFleetWSprecedenti = new ParametriGeoFleetWS();
      this.parametriGeoFleetWSprecedenti.reset();

      this.opzioni = new Opzioni();

      this.subscription.add(
        this.gestioneParametriService.getParametriGeoFleetWS()
        .subscribe( parm => { 
          // se è  stato modificato il tipo di estrazione dal ws o le coordinate del riquadro
          // allora resetta l'istante di acquisizione precedente
          // in quanto deve effettuare una nuova estrazione senza limite temporale.
          //if (this.opzioni.getOnlyMap() &&
          //console.log('PosizioneFlottaService.getParametriGeoFleetWS()', parm);
          if  (parm.getRichiestaAPI() != this.parametriGeoFleetWS.getRichiestaAPI()
              || parm.getClassiMezzo() != this.parametriGeoFleetWS.getClassiMezzo()
              || 
                (this.opzioni.getOnlyMap() && 
                  ( parm.getLat1() != this.parametriGeoFleetWS.getLat1()
                    || parm.getLon1() != this.parametriGeoFleetWS.getLon1()
                    || parm.getLat2() != this.parametriGeoFleetWS.getLat2()
                    || parm.getLon2() != this.parametriGeoFleetWS.getLon2()
                  )
                )
              )
          { 
            //console.log('PosizioneFlottaService.getParametriGeoFleetWS() - reset');
            this.maxIstanteAcquisizionePrecedente = null; 
            this.subjectReset$.next(true);
          }
          this.parametriGeoFleetWSprecedenti.set(this.parametriGeoFleetWS);
          this.parametriGeoFleetWS.set(parm);
        })
      );   

      this.subscription.add(
        this.gestioneOpzioniService.getOpzioni()
        .subscribe( opt => { this.opzioni = opt; })
      );   
  
      
    }

    
    public getURL(): Observable<PosizioneMezzo[]> {
      // onde evitare eventuali problemi di sincronizzazione con il servizio 
      // per la gestione dei parametri del WS, salvo i parametri in una var locale
      
      var parm : ParametriGeoFleetWS = new ParametriGeoFleetWS();
      parm.set(this.parametriGeoFleetWS);

      //console.log("PosizioneFlottaService.getURL() - istanteUltimoAggiornamento, parm", this.istanteUltimoAggiornamento, parm);
      
      // aggiungere sempre X secondi per essere sicuri di perdersi
      // meno posizioni possibili, a causa della distanza di tempo tra
      // l'invio della richiesta dal client e la sua ricezione dal ws
      // Per essere certi, è necessaria un API che restituisca i messaggi
      // acquisiti successivamente ad un certo istante
      
      if (this.maxIstanteAcquisizionePrecedente != null) 
      {
        var attSec = moment(this.istanteUltimoAggiornamento).
        diff(this.maxIstanteAcquisizionePrecedente, 'seconds').valueOf() + 
        this.trimSec.valueOf() ; 
        parm.setAttSec(attSec);
        // aggiorno l'intervallo temporale estratto nel servizio
        // per la gestione dei parametri del WS
        this.gestioneParametriService.setAttSec(attSec);
      }

      var parametri : string = '';
      var richiestaWS : string = '';
      if (parm.getAttSec() != null) { parametri = parametri+ 
        (parametri == '' ? '?': '&') + 'attSec='+ String(parm.getAttSec()); }

      // se viene inviata la richiesta 'inRettangolo' aggiunge i relativi parametri
      if ( parm.getRichiestaAPI() == 'inRettangolo') {          
        if (parm.getLat1() != null) { parametri = parametri+
          (parametri == '' ? '?': '&') + 'lat1='+ String(parm.getLat1()); }
        if (parm.getLon1() != null) { parametri = parametri+
          (parametri == '' ? '?': '&') + 'lon1='+ String(parm.getLon1()); }
        if (parm.getLat2() != null) { parametri = parametri+
          (parametri == '' ? '?': '&') + 'lat2='+ String(parm.getLat2()); }
        if (parm.getLon2() != null) { parametri = parametri+
          (parametri == '' ? '?': '&') + 'lon2='+ String(parm.getLon2()); }
      }

      if (parametri != '' ) 
        { richiestaWS = parm.getRichiestaAPI() + parametri; }
      else 
        { richiestaWS = parm.getRichiestaAPI(); }

      //console.log("PosizioneFlottaService.getURL() - richiestaWS",API_URL + richiestaWS);
          
      var observable: Observable<Response> = this.http.get(API_URL + richiestaWS);

      if ( parm.getRichiestaAPI() == 'posizioneFlotta')
      {        
          this.obsPosizioniMezzo$ = observable.
          map((r : Response) => 
          {  
          return r.json().
          map((e : PosizioneMezzo) => 
            { if (e.infoSO115 == null) 
              { 
                e.infoSO115 = Object.create( {stato: String}); 
                e.infoSO115.stato = "0";
              }
              if (e.infoSO115.stato == null || e.infoSO115.stato == "" )
              {
                e.infoSO115.stato = "0";              
              }
              //e.tooltipText = Object.create(String.prototype);
              e.sedeMezzo = this.sedeMezzo(e);
              e.destinazioneUso = this.destinazioneUso(e);
              e.selezionato = false;
              e.toolTipText = this.toolTipText(e);
              e.classiMezzoDepurata = this.classiMezzoDepurata(e);
              e.descrizionePosizione = e.classiMezzoDepurata.toString() + " " + e.codiceMezzo + " (" + e.sedeMezzo + ")";            
              e.visibile = false;
              let posizioneMezzo = Object.create(PosizioneMezzo.prototype);
              Object.assign(posizioneMezzo, e);
              return posizioneMezzo;
            }
          )           
          }),
          catchError(this.handleError)
        ;  
      }

      if ( parm.getRichiestaAPI() == 'inRettangolo')
      {

        this.obsPosizioniMezzo$ = observable.
        map((r : Response) => 
          {
            return r.json().risultati.map( 
            (e : PosizioneMezzo) => 

              { if (e.infoSO115 == null) { 
                  e.infoSO115 = Object.create( {stato: String}); 
                  e.infoSO115.stato = "0";
                }
                if (e.infoSO115.stato == null || e.infoSO115.stato == "" )
                {
                  e.infoSO115.stato = "0";              
                }
                e.sedeMezzo = this.sedeMezzo(e);
                e.destinazioneUso = this.destinazioneUso(e);
                e.selezionato = false;
                e.toolTipText = this.toolTipText(e);
                e.classiMezzoDepurata = this.classiMezzoDepurata(e);
                e.descrizionePosizione = e.classiMezzoDepurata.toString() + " " + e.codiceMezzo + " (" + e.sedeMezzo + ")";
                e.visibile = false;
                let posizioneMezzo = Object.create(PosizioneMezzo.prototype);
                return Object.assign(posizioneMezzo, e);

              });
          }),
        catchError(this.handleError);      

      };

      return this.obsPosizioniMezzo$;
    }
    
    public getReset(): Observable<Boolean> {      
      return this.subjectReset$.asObservable();
    }

    public getPosizioneFlotta(): Observable<PosizioneMezzo[]> {

        // subscribe al timer per l'aggiornamento periodico della Situazione flotta
        this.timerSubcribe = this.timer.subscribe(t => 
          {
            this.getURL().subscribe( (r : PosizioneMezzo[]) => {
              //console.log('PosizioneFlottaService.getPosizioneFlotta() - r',r);
              this.setIstanteUltimoAggiornamento(r);
              this.subjectPosizioniMezzo$.next(r); 
              });

          }
        );

        //console.log('PosizioneFlottaService.getPosizioneFlotta() - subjectPosizioniMezzo$',this.subjectPosizioniMezzo$);
        return this.subjectPosizioniMezzo$.asObservable();
      };
  
    private handleError(error: Response | any) {
      if (error != null)
      { console.error('ApiService::handleError', error);
        return Observable.throw(error);
      }
    }

    private setIstanteUltimoAggiornamento(elencoPosizioniWS: PosizioneMezzo[])
    {       
        // memorizza l'istante di inizio di questa operazione di aggiornamento
        this.istanteUltimoAggiornamento = moment().toDate();      
     
        if (elencoPosizioniWS.length > 0) {
          //l'attSec deve essere calcolato in relazione all'istante 
          //più alto ma comunque precedente all'istanteUltimoAggiornamento, per escludere 
          //eventuali messaggi "futuri", che potrebbero essere ricevuti dagli adapter SO115
          //a seguito di errata impostazione della data di sistema sui server dei Comandi Provinciali

          var elencoPosizioniMezzoDepurate : PosizioneMezzo[];
          elencoPosizioniMezzoDepurate = elencoPosizioniWS.filter(
            i => (new Date(i.istanteAcquisizione) < new Date(this.istanteUltimoAggiornamento) )
          );            

          // imposta maxIstanteAcquisizione filtrando le posizioni precedenti all'
          // istanteUltimoAggiornamento
          if (elencoPosizioniMezzoDepurate.length > 0) {
            this.maxIstanteAcquisizione = new Date(elencoPosizioniMezzoDepurate.
              reduce( function (a,b) 
              { var bb : Date = new Date(b.istanteAcquisizione);
                var aa : Date  = new Date(a.istanteAcquisizione);
                return aa>bb ? a : b ;
              }).istanteAcquisizione);

            }

          // imposta trimSec calcolando la differenza di tempo tra l'
          // istanteUltimoAggiornamento e l'istanteAcquisizione più alto tra le posizioni ricevute, 
          // purchè succesive a istanteUltimoAggiornamento
          this.trimSec = 0;
          var elencoPosizioniDaElaborare : PosizioneMezzo[];

          elencoPosizioniDaElaborare = elencoPosizioniWS.filter(
            i => (new Date(i.istanteAcquisizione) >= new Date(this.maxIstanteAcquisizionePrecedente) )
            );

          //console.log("elencoPosizioniDaElaborare", elencoPosizioniDaElaborare);
          if (elencoPosizioniDaElaborare.length > 0) {
              this.trimSec = moment(
                new Date(elencoPosizioniDaElaborare.
                    reduce( function (a,b) 
                    { var bb : Date = new Date(b.istanteAcquisizione);
                      var aa : Date  = new Date(a.istanteAcquisizione);
                      return aa>bb ? a : b ;
                    }).istanteAcquisizione)).diff(this.istanteUltimoAggiornamento, 'seconds');
            }
          //console.log("trimSec", this.trimSec);
          this.trimSec = (this.trimSec.valueOf() > 0 ) ? this.trimSec.valueOf() + 10: 10;
          //console.log("trimSec adj", this.trimSec);

   
                
          if (elencoPosizioniMezzoDepurate.length > 0) {
            this.maxIstanteAcquisizionePrecedente = this.maxIstanteAcquisizione;
          }
                   
        }      

        // restituisce l'istante di inizio di questa operazione di aggiornamento
        this.subjectIstanteUltimoAggiornamento$.next(this.istanteUltimoAggiornamento);
    }
        
    public getIstanteUltimoAggiornamento(): Observable<Date> {
      return this.subjectIstanteUltimoAggiornamento$.asObservable();                
    }  
  
    sedeMezzo(p : PosizioneMezzo) {
      //return p.classiMezzo.find( i =>  i.substr(0,5) == "PROV:".substr(5,2));
      
      var r : string;
      if (p.classiMezzo != null) {
        r = p.classiMezzo.find( i =>  (i.substr(0,5) == "PROV:"));
        r = (r != null) ?  r.substr(5,2) : ".."; } 
      return ( r != null ? r: "..");    
    }
    

    destinazioneUso(p : PosizioneMezzo) {
      //return p.classiMezzo.find( i =>  i.substr(0,5) == "PROV:".substr(5,2));
      
      var r : string;
      if (p.classiMezzo != null) {
        r = p.classiMezzo.find( i =>  (i.substr(0,5) == "USO:"));
        //r = (r != null) ?  r.substr(5,2) : ".."; } 
        r = (r != null) ?  r.substr(5,2) : "CORP"; } 
      return ( r != null ? r: "..");
    }
    
  
    classiMezzoDepurata(p : PosizioneMezzo) {
      return p.classiMezzo.
        filter( i =>  (i.substr(0,5) != "PROV:") ).
        filter( i =>  (i.substr(0,5) != "USO:") )
    }
      
    toolTipText(item : PosizioneMezzo) {
      var testo : string;
      var opzioniDataOra = {};
      //" (" + this.sedeMezzo(item) + ") del " + 
      testo = this.classiMezzoDepurata(item) + " " + item.codiceMezzo +
      " (" + item.sedeMezzo + ") del " + 
      new Date(item.istanteAcquisizione).toLocaleString() + 
      " (da " + item.fonte.classeFonte + ":" + item.fonte.codiceFonte + ")";

      if (item.infoSO115 != null && 
        item.infoSO115.codiceIntervento != null &&
          new Number(item.infoSO115.codiceIntervento) != 0) {
        testo = testo + " - Intervento " + item.infoSO115.codiceIntervento + " del " +
        new Date(item.infoSO115.dataIntervento).toLocaleDateString() ;
      }
      return testo;
    }  


  }