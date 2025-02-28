import Semaphore from "@chriscdn/promise-semaphore";
import { unixfs } from "@helia/unixfs";
import { Libp2p } from "@libp2p/interface";
import deepEqual from "deep-equal";
import { எண்ணிக்கை } from "ennikkai";
import indexedDbStream from "indexed-db-stream";
import plateforme from "platform";
import { v4 as uuidv4 } from "uuid";
import {
  adresseOrbiteValide,
  suivreBdDeFonction,
  suivreBdsDeFonctionListe,
  faisRien,
  ignorerNonDéfinis,
  sauvegarderFichierZip,
  toBuffer,
} from "@constl/utils-ipa";
import {
  TypedFeed,
  TypedKeyValue,
  TypedOrderedKeyValue,
  TypedSet,
} from "@constl/bohr-db";
import { ERREUR_INIT_IPA_DÉJÀ_LANCÉ } from "@constl/mandataire";
import { JSONSchemaType } from "ajv";
import Base64 from "crypto-js/enc-base64.js";
import md5 from "crypto-js/md5.js";
import sha256 from "crypto-js/sha256.js";
import { randomBytes } from "@noble/hashes/utils";
import bs58 from "bs58";

import { HeliaLibp2p } from "helia";
import JSZip from "jszip";
import { CID } from "multiformats";
import { isBrowser, isElectronMain, isNode } from "wherearewe";
import { isValidAddress } from "@orbitdb/core";
import { TypedEmitter } from "tiny-typed-emitter";
import {
  fromString as uint8ArrayFromString,
  toString as uint8ArrayToString,
} from "uint8arrays";
import { keys } from "@libp2p/crypto";
import { Automatisations } from "@/automatisation.js";
import { BDs } from "@/bds.js";
import { Épingles } from "@/epingles.js";
import {
  Favoris,
  INSTALLÉ,
  TOUS,
  résoudreDéfauts,
  ÉpingleCompte,
  ÉpingleFavoris,
  ÉpingleFavorisAvecId,
} from "@/favoris.js";
import { Licences } from "@/licences.js";
import { MotsClefs } from "@/motsClefs.js";
import { Nuées } from "@/nuées.js";
import { Profil } from "@/profil.js";
import { Projets } from "@/projets.js";
import { Recherche } from "@/recherche/index.js";
import { Réseau } from "@/reseau.js";
import { Tableaux } from "@/tableaux.js";
import { Variables } from "@/variables.js";

import { cacheSuivi } from "@/décorateursCache.js";

import {
  type OptionsContrôleurConstellation,
  ContrôleurConstellation as générerContrôleurConstellation,
  nomType as nomTypeContrôleurConstellation,
} from "@/accès/cntrlConstellation.js";
import stockageLocal, { exporterStockageLocal } from "@/stockageLocal.js";
import {
  Jsonifiable,
  RecursivePartial,
  schémaFonctionOublier,
  schémaFonctionSuivi,
  schémaRetourFonctionRechercheParProfondeur,
  élémentsBd,
} from "@/types.js";
import { MEMBRE, MODÉRATEUR, rôles } from "@/accès/consts.js";
import {
  type GestionnaireOrbite,
  gestionnaireOrbiteGénéral,
  Store,
} from "@/orbite.js";
import { initSFIP } from "@/sfip/index.js";
import { Protocoles } from "./protocoles.js";
import type { PrivateKey } from "@libp2p/interface";
import type { ServicesLibp2p } from "@/sfip/index.js";
import type { ContenuMessageRejoindreCompte, statutDispositif } from "@/reseau.js";
import type { infoUtilisateur, objRôles } from "@/accès/types.js";
import type { SetDatabaseType } from "@orbitdb/set-db";
import type { OrderedKeyValueDatabaseType } from "@orbitdb/ordered-keyvalue-db";
import type { FeedDatabaseType } from "@orbitdb/feed-db";
import type {
  createOrbitDB,
  IPFSAccessController as générerIPFSAccessController,
  OrbitDB,
  AccessController,
  KeyValueDatabase,
  OpenDatabaseOptions,
} from "@orbitdb/core";

type IPFSAccessController = Awaited<
  ReturnType<ReturnType<typeof générerIPFSAccessController>>
>;

type schémaFonctionRéduction<T, U> = (branches: T) => U;

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

type ÉvénementsClient<T extends ServicesLibp2p = ServicesLibp2p> = {
  comptePrêt: (args: { idCompte: string }) => void;
  erreurInitialisation: (args: Error) => void;
  sfipEtOrbitePrêts: (args: {
    sfip: HeliaLibp2p<Libp2p<T>>;
    orbite: GestionnaireOrbite;
  }) => void;
};

const estOrbiteDB = (x: unknown): x is OrbitDB => {
  if (!x) return false;
  const xCommeOrbite = x as OrbitDB;
  return !!(
    xCommeOrbite.id &&
    typeof xCommeOrbite.open === "function" &&
    typeof xCommeOrbite.stop === "function" &&
    xCommeOrbite.ipfs
  );
};

export type infoAccès = {
  idCompte: string;
  rôle: keyof objRôles;
};

export interface Signature {
  signature: string;
  clefPublique: string;
}

export interface optsConstellation<T extends ServicesLibp2p = ServicesLibp2p> {
  dossier?: string;
  sujetRéseau?: string;
  protocoles?: string[];
  orbite?: optsOrbite<T>;
  messageVerrou?: string;
}

export type optsInitOrbite<T extends ServicesLibp2p = ServicesLibp2p> = Omit<
  Parameters<typeof createOrbitDB>[0],
  "ipfs" | "directory"
> & {
  directory?: string;
  ipfs?: HeliaLibp2p<Libp2p<T>>;
};

export type optsOrbite<T extends ServicesLibp2p = ServicesLibp2p> =
  | OrbitDB<T>
  | optsInitOrbite<T>;

export type structureBdCompte = {
  protocoles?: string;

  profil?: string;
  motsClefs?: string;
  variables?: string;
  bds?: string;
  projets?: string;
  nuées?: string;
  favoris?: string;

  réseau?: string;
  automatisations?: string;
};

export const schémaStructureBdCompte: JSONSchemaType<structureBdCompte> = {
  type: "object",
  properties: {
    protocoles: { type: "string", nullable: true },

    profil: { type: "string", nullable: true },
    motsClefs: { type: "string", nullable: true },
    variables: { type: "string", nullable: true },
    bds: { type: "string", nullable: true },
    projets: { type: "string", nullable: true },
    nuées: { type: "string", nullable: true },
    favoris: { type: "string", nullable: true },

    réseau: { type: "string", nullable: true },
    automatisations: { type: "string", nullable: true },
  },
  required: [],
};

export type structureNomsDispositifs = {
  [idDispositif: string]: { nom?: string; type?: string };
};
export const schémaStructureNomsDispositifs: JSONSchemaType<structureNomsDispositifs> =
  {
    type: "object",
    additionalProperties: {
      type: "object",
      properties: {
        nom: { type: "string", nullable: true },
        type: { type: "string", nullable: true },
      },
    },
    required: [],
  };

const DÉLAI_EXPIRATION_INVITATIONS = 1000 * 60 * 5; // 5 minutes

const obtDossierConstellation = async (
  opts: optsConstellation,
): Promise<string> => {
  if (opts.dossier && opts.dossier !== "dév") {
    if (isNode || isElectronMain) {
      const fs = await import("fs");
      if (!fs.existsSync(opts.dossier))
        fs.mkdirSync(opts.dossier, { recursive: true });
    }
    return opts.dossier;
  }

  if (isNode || isElectronMain) {
    const fs = await import("fs");
    // Utiliser l'application native
    const envPaths = (await import("env-paths")).default;
    const chemins = envPaths("constl", { suffix: "" });
    const dossier = await join(
      chemins.data,
      opts.dossier === "dév" ? "constl-dév" : "constl",
    );
    if (!fs.existsSync(dossier)) fs.mkdirSync(dossier, { recursive: true });
    return dossier;
  } else {
    // Pour navigateur
    return "./constl";
  }
};

const join = async (...args: string[]) => {
  if (isNode || isElectronMain) {
    // Utiliser l'application native
    const { join } = await import("path");
    return join(...args);
  } else {
    return args.join("/");
  }
};

export class Constellation<T extends ServicesLibp2p = ServicesLibp2p> {
  _opts: optsConstellation<T>;
  événements: TypedEmitter<ÉvénementsClient<T>>;

  orbite?: GestionnaireOrbite;
  sfip?: HeliaLibp2p<Libp2p<T>>;

  épingles: Épingles;
  profil: Profil;
  bds: BDs;
  tableaux: Tableaux;
  variables: Variables;
  réseau: Réseau;
  favoris: Favoris;
  projets: Projets;
  recherche: Recherche;
  motsClefs: MotsClefs;
  automatisations: Automatisations;
  nuées: Nuées;
  licences: Licences;
  protocoles: Protocoles;

  erreurInitialisation?: Error;
  _orbiteExterne: boolean;
  _sfipExterne: boolean;

  idCompte?: string;
  sujet_réseau: string;
  motsDePasseRejoindreCompte: { [key: string]: number };
  ennikkai: எண்ணிக்கை;

  verrouObtIdBd: Semaphore;
  _intervaleVerrou?: NodeJS.Timeout;
  signaleurArrêt: AbortController;

  constructor(opts: optsConstellation<T> = {}) {
    this._opts = opts;

    this.événements = new TypedEmitter<ÉvénementsClient<T>>();
    this.signaleurArrêt = new AbortController();

    this.sujet_réseau = opts.sujetRéseau || "réseau-constellation";
    this.motsDePasseRejoindreCompte = {};

    this.verrouObtIdBd = new Semaphore();

    this._orbiteExterne = this._sfipExterne = false;

    this.ennikkai = new எண்ணிக்கை({});

    this.épingles = new Épingles({ client: this });

    this.profil = new Profil({ client: this });

    this.motsClefs = new MotsClefs({ client: this });

    this.tableaux = new Tableaux({ client: this });

    this.variables = new Variables({ client: this });

    this.bds = new BDs({ client: this });

    this.projets = new Projets({ client: this });

    this.nuées = new Nuées({ client: this });

    this.favoris = new Favoris({ client: this });

    this.automatisations = new Automatisations({ client: this });

    this.recherche = new Recherche({ client: this });

    this.licences = new Licences({ client: this });

    this.réseau = new Réseau({ client: this });

    this.protocoles = new Protocoles({ client: this });

    this._initialiser();
  }

  async dossier(): Promise<string> {
    return await obtDossierConstellation(this._opts);
  }

  async _initialiser(): Promise<void> {
    try {
      await this.verrouillerDossier({ message: this._opts.messageVerrou });
    } catch (e) {
      this.erreurInitialisation = e;
      await this.fermerCompte();
      await this.épingles.fermer();
      this.événements.emit("erreurInitialisation", e);
    }

    const { sfip, orbite } = await this._générerSFIPetOrbite();
    this.sfip = sfip;
    this.orbite = gestionnaireOrbiteGénéral.obtGestionnaireOrbite({ orbite });
    this.événements.emit("sfipEtOrbitePrêts", { sfip, orbite: this.orbite });

    const optionsAccèsRacine = {
      type: nomTypeContrôleurConstellation,
      write: this.orbite.identity.id,
      nom: "racine",
    };

    this.idCompte =
      (await this.obtDeStockageLocal({
        clef: "idCompte",
        parCompte: false,
      })) || undefined;
    if (!this.idCompte) {
      this.idCompte = await this.créerBdIndépendante({
        type: "keyvalue",
        optionsAccès: optionsAccèsRacine,
        nom: "racine",
      });

      await this.nommerDispositif({
        type: this.détecterTypeDispositif(),
      });

      await this.sauvegarderAuStockageLocal({
        clef: "idCompte",
        val: this.idCompte,
        parCompte: false,
      });
    }

    await this.réseau.initialiser();
    await this.protocoles.établirProtocoles({
      protocoles: this._opts.protocoles,
    });

    this.événements.emit("comptePrêt", { idCompte: this.idCompte });

    const épingle: ÉpingleCompte = {
      type: "compte",
      base: TOUS,
      profil: {
        type: "profil",
        base: TOUS,
        fichiers: TOUS,
      },
      favoris: TOUS,
    };
    await this.épinglerCompte({
      idCompte: this.idCompte,
      options: épingle,
    });
  }

  async épinglerCompte({
    idCompte,
    options = {},
  }: {
    idCompte: string;
    options?: RecursivePartial<ÉpingleCompte>;
  }) {
    const épingle: ÉpingleCompte = résoudreDéfauts(options, {
      type: "compte",
      base: TOUS,
      profil: {
        type: "profil",
        base: TOUS,
        fichiers: INSTALLÉ,
      },
      favoris: TOUS,
    });
    await this.favoris.épinglerFavori({ idObjet: idCompte, épingle });
  }

  async suivreÉpingleCompte({
    idCompte,
    f,
    idCompteQuiÉpingle,
  }: {
    idCompte: string;
    f: schémaFonctionSuivi<ÉpingleCompte | undefined>;
    idCompteQuiÉpingle?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.favoris.suivreÉtatFavori({
      idObjet: idCompte,
      f: async (épingle) => {
        if (épingle?.type === "compte") await f(épingle);
        else await f(undefined);
      },
      idCompte: idCompteQuiÉpingle,
    });
  }

  détecterTypeDispositif(): string | undefined {
    if (isElectronMain) {
      return "ordinateur";
    } else if (isNode) {
      return "serveur";
    } else if (isBrowser) {
      if (
        ["Pad", "Kindle", "Nexus", "Nook", "PlayBook"].find((x) =>
          plateforme.product?.includes(x),
        )
      ) {
        return "tablette";
      } else if (
        plateforme.name?.includes("Mobile") ||
        ["Phone", "Android", "iOS"].find((x) =>
          plateforme.os?.family?.includes(x),
        )
      ) {
        return "téléphone";
      }
      return "navigateur";
    }
    return undefined;
  }

  async attendreSfipEtOrbite(): Promise<{
    orbite: GestionnaireOrbite;
    sfip: HeliaLibp2p<Libp2p<T>>;
  }> {
    if (this.sfip && this.orbite) {
      return {
        sfip: this.sfip,
        orbite: this.orbite,
      };
    }
    return new Promise((résoudre) => {
      this.événements.once("sfipEtOrbitePrêts", résoudre);
    });
  }

  async attendreInitialisée(): Promise<{ idCompte: string }> {
    if (this.erreurInitialisation) throw this.erreurInitialisation;
    if (this.idCompte) {
      return {
        idCompte: this.idCompte as string,
      };
    } else {
      return new Promise((résoudre, rejeter) => {
        this.événements.once("comptePrêt", résoudre);
        this.événements.once("erreurInitialisation", rejeter);
      });
    }
  }

  async verrouillerDossier({ message }: { message?: string }): Promise<void> {
    const intervaleVerrou = 5000; // 5 millisecondes
    if (isElectronMain || isNode) {
      const fs = await import("fs");
      const fichierVerrou = await join(await this.dossier(), "VERROU");
      const maintenant = new Date();
      if (!fs.existsSync(fichierVerrou)) {
        fs.writeFileSync(fichierVerrou, message || "");
      } else {
        const infoFichier = fs.statSync(fichierVerrou);
        const modifiéÀ = infoFichier.mtime;
        const verifierSiVieux = () => {
          if (maintenant.getTime() - modifiéÀ.getTime() > intervaleVerrou) {
            fs.writeFileSync(fichierVerrou, message || "");
          } else {
            const contenuFichier = new TextDecoder().decode(
              fs.readFileSync(fichierVerrou),
            );
            try {
              const messageJSON = JSON.parse(contenuFichier);
              if (messageJSON["port"]) {
                const erreur = new Error(
                  `Ce compte est déjà ouvert en Constellation, et le serveur local est disponible sur le port ${messageJSON["port"]}. Vous pouvez soit vous connecter sur ce port, soit fermer les instances de Constellation qui ouvertes et puis vous ressayer.`,
                );
                erreur.name = ERREUR_INIT_IPA_DÉJÀ_LANCÉ;
                throw erreur;
              }
            } catch {
              //
            }
            const erreur = new Error("Constellation est déjà lancée.");
            erreur.name = ERREUR_INIT_IPA_DÉJÀ_LANCÉ;
            throw erreur;
          }
        };
        try {
          verifierSiVieux();
        } catch {
          await new Promise((résoudre) =>
            setTimeout(résoudre, intervaleVerrou),
          );
          verifierSiVieux();
        }
      }
      this._intervaleVerrou = setInterval(() => {
        try {
          fs.utimesSync(fichierVerrou, maintenant, maintenant);
        } catch {
          // On s'inquiète pas trop
        }
      }, intervaleVerrou);
    }
  }

  async spécifierMessageVerrou({
    message,
  }: {
    message: Jsonifiable;
  }): Promise<void> {
    await this.attendreInitialisée();
    if (isElectronMain || isNode) {
      const fs = await import("fs");
      const fichierVerrou = await join(await this.dossier(), "VERROU");
      const contenu = JSON.parse(fs.readFileSync(fichierVerrou).toString());
      const contenuFinal = Object.assign(contenu, message);
      fs.writeFileSync(fichierVerrou, JSON.stringify(contenuFinal));
    }
  }

  async effacerVerrou() {
    if (isElectronMain || isNode) {
      if (this._intervaleVerrou) clearInterval(this._intervaleVerrou);
      const fs = await import("fs");
      fs.rmSync(await join(await this.dossier(), "VERROU"));
    }
  }

  async _générerSFIPetOrbite(): Promise<{
    sfip: HeliaLibp2p<Libp2p<T>>;
    orbite: OrbitDB<T>;
  }> {
    const dossier = await this.dossier();

    const { orbite } = this._opts;

    let sfipFinale: HeliaLibp2p<Libp2p<T>>;
    let orbiteFinale: OrbitDB<T>;

    let clefPrivée: PrivateKey | undefined = undefined;
    const texteClefPrivée = await this.obtDeStockageLocal({
      clef: "idPairLibp2p",
      parCompte: false,
    });
    if (texteClefPrivée) {
      const encoded = uint8ArrayFromString(texteClefPrivée, "base64");
      clefPrivée = keys.privateKeyFromRaw(encoded);
    }

    if (orbite) {
      if (estOrbiteDB(orbite)) {
        this._sfipExterne = this._orbiteExterne = true;
        sfipFinale = orbite.ipfs;
        orbiteFinale = orbite;
      } else {
        // Éviter d'importer la configuration BD Orbite si pas nécessaire
        const { initOrbite } = await import("@/orbite.js");

        if (orbite.ipfs) {
          this._sfipExterne = true;
          sfipFinale = orbite.ipfs;
        } else {
          sfipFinale = (await initSFIP({
            dossier: await join(dossier, "sfip"),
            clefPrivée,
          })) as unknown as HeliaLibp2p<Libp2p<T>>;
        }
        orbiteFinale = await initOrbite({
          sfip: sfipFinale,
          dossierOrbite: orbite.directory || (await join(dossier, "orbite")),
        });
        sfipFinale = orbiteFinale.ipfs;
      }
    } else {
      sfipFinale = (await initSFIP({
        dossier: await join(await this.dossier(), "sfip"),
        clefPrivée,
      })) as unknown as HeliaLibp2p<Libp2p<T>>;

      const { initOrbite } = await import("@/orbite.js");
      orbiteFinale = await initOrbite({
        sfip: sfipFinale,
        dossierOrbite: await join(await this.dossier(), "orbite"),
      });
    }

    if (!clefPrivée) {
      const clefPrivéeGénérée =
        orbiteFinale.ipfs.libp2p.services.obtClefPrivée.obtenirClef();
      const texteNouvelleClefPrivée = uint8ArrayToString(
        clefPrivéeGénérée.raw,
        "base64",
      );
      await this.sauvegarderAuStockageLocal({
        clef: "idPairLibp2p",
        val: texteNouvelleClefPrivée,
        parCompte: false,
      });
    }

    return { sfip: sfipFinale, orbite: orbiteFinale };
  }

  async obtOptionsAccès(): Promise<OptionsContrôleurConstellation> {
    const idCompte = await this.obtIdCompte();
    return {
      write: idCompte,
    };
  }

  async suivreRésolutionÉpingle({
    épingle,
    f,
    ignorer,
  }: {
    épingle: ÉpingleFavorisAvecId<ÉpingleCompte>;
    f: schémaFonctionSuivi<Set<string>>;
    ignorer?: Set<string>;
  }) {
    const épinglerBase = await this.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.base || "TOUS",
    });
    const épinglerProfil = épingle.épingle.profil;
    const épinglerFavoris = await this.favoris.estÉpingléSurDispositif({
      dispositifs: épingle.épingle.favoris || "AUCUN",
    });

    const info: {
      base?: string[];
      profil?: string[];
      favoris?: string[];
    } = {};

    const fFinale = async () => {
      return await f(
        new Set(
          Object.values(info)
            .flat()
            .filter((x) => !!x) as string[],
        ),
      );
    };

    const fsOublier: schémaFonctionOublier[] = [];
    if (épinglerBase) {
      const fOublierBase = await this.suivreBd({
        id: épingle.idObjet,
        type: "keyvalue",
        schéma: schémaStructureBdCompte,
        f: async (bd) => {
          try {
            const contenuBd = await bd.allAsJSON();
            info.base = [
              épingle.idObjet,
              contenuBd.automatisations,
              contenuBd.bds,
              contenuBd.favoris,
              contenuBd.motsClefs,
              contenuBd.nuées,
              contenuBd.profil,
              contenuBd.projets,
              contenuBd.protocoles,
              contenuBd.réseau,
              contenuBd.variables,
            ].filter((x) => !!x) as string[];
          } catch {
            return; // Si la structure n'est pas valide.
          }
          return await fFinale();
        },
      });
      fsOublier.push(fOublierBase);
    }
    if (épinglerProfil) {
      const fOublierProfil = await suivreBdDeFonction({
        fRacine: async ({
          fSuivreRacine,
        }: {
          fSuivreRacine: (
            nouvelIdBdCible?: string | undefined,
          ) => Promise<void>;
        }) => {
          return await this.suivreBd({
            id: épingle.idObjet,
            type: "keyvalue",
            schéma: schémaStructureBdCompte,
            f: async (bd) => await fSuivreRacine((await bd.allAsJSON()).profil),
          });
        },
        fSuivre: async ({
          id,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<Set<string>>;
        }) => {
          return await this.profil.suivreRésolutionÉpingle({
            épingle: { idObjet: id, épingle: épinglerProfil },
            f: fSuivreBd,
          });
        },
        f: async (idcs) => {
          info.profil = idcs ? [...idcs] : [];
          return await fFinale();
        },
      });
      fsOublier.push(fOublierProfil);
    }
    if (épinglerFavoris) {
      const fOublierFavoris = await suivreBdsDeFonctionListe({
        fListe: async (
          fSuivreRacine: (
            éléments: ÉpingleFavorisAvecId<ÉpingleFavoris>[],
          ) => Promise<void>,
        ) => {
          return await this.favoris.suivreFavoris({
            f: fSuivreRacine,
            idCompte: épingle.idObjet,
          });
        },
        fBranche: async (
          _id: string,
          fSuivreBranche: schémaFonctionSuivi<Set<string>>,
          branche: ÉpingleFavorisAvecId,
        ) => {
          return await this.favoris.suivreRésolutionÉpingle({
            épingle: branche,
            f: fSuivreBranche,
            ignorer,
          });
        },
        f: async (favoris: Set<string>[]) => {
          info.favoris = favoris.map((f) => [...f]).flat();
          return await fFinale();
        },
        fIdBdDeBranche: (b) => b.idObjet,
        fCode: (b) => b.idObjet,
      });
      fsOublier.push(fOublierFavoris);
    }

    return async () => {
      await Promise.all(fsOublier.map((f) => f()));
    };
  }

  async ouvrirBd<T extends KeyValueDatabase>({
    id,
    type,
    signal,
    options,
  }: {
    id: string;
    type: "keyvalue";
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends FeedDatabaseType>({
    id,
    type,
    signal,
    options,
  }: {
    id: string;
    type: "feed";
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends SetDatabaseType>({
    id,
    type,
    signal,
    options,
  }: {
    id: string;
    type: "set";
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends OrderedKeyValueDatabaseType>({
    id,
    type,
    signal,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue";
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    signal,
  }: {
    id: string;
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    type,
    signal,
    options,
  }: {
    id: string;
    type?: "keyvalue" | "feed" | "set" | "ordered-keyvalue";
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBd<T extends Store>({
    id,
    type,
    signal,
    options,
  }: {
    id: string;
    type?: "keyvalue" | "feed" | "set" | "ordered-keyvalue";
    signal?: AbortSignal;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{
    bd: T;
    fOublier: schémaFonctionOublier;
  }> {
    const { orbite } = await this.attendreSfipEtOrbite();
    return await orbite.ouvrirBd({
      id,
      type,
      signal,
      options,
    });
  }

  async ouvrirBdTypée<
    U extends { [clef: string]: élémentsBd },
    T = TypedKeyValue<U>,
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "keyvalue";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T = TypedFeed<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "feed";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T = TypedSet<U>>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "set";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<
    U extends { [clef: string]: élémentsBd },
    T = TypedOrderedKeyValue<U>,
  >({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }>;
  async ouvrirBdTypée<U extends élémentsBd, T>({
    id,
    type,
    schéma,
    options,
  }: {
    id: string;
    type: "ordered-keyvalue" | "set" | "keyvalue" | "feed";
    schéma: JSONSchemaType<U>;
    options?: Omit<OpenDatabaseOptions, "type">;
  }): Promise<{ bd: T; fOublier: schémaFonctionOublier }> {
    const { orbite } = await this.attendreSfipEtOrbite();
    return await orbite.ouvrirBdTypée({
      id,
      // @ts-expect-error Va donc comprendre
      type,
      // @ts-expect-error Va donc comprendre
      schéma,
      options,
    });
  }

  async signer({ message }: { message: string }): Promise<Signature> {
    const { orbite } = await this.attendreSfipEtOrbite();
    const id = orbite.identity;
    const signature = await orbite.identity.sign(id, message);
    const clefPublique = orbite.identity.publicKey;
    return { signature, clefPublique };
  }

  async vérifierSignature({
    signature,
    message,
  }: {
    signature: Signature;
    message: string;
  }): Promise<boolean> {
    if (!signature || !signature.clefPublique || !signature.signature) {
      return false;
    }
    const { orbite } = await this.attendreSfipEtOrbite();
    return await orbite.identity.verify(
      signature.signature,
      signature.clefPublique,
      message,
    );
  }

  @cacheSuivi
  async suivreDispositifs({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fSuivi = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[] | undefined>;
    }): Promise<schémaFonctionOublier> => {
      const { orbite } = await this.attendreSfipEtOrbite();
      const { bd, fOublier } = await orbite.ouvrirBdTypée({
        id,
        type: "keyvalue",
        schéma: schémaStructureBdCompte,
      });
      const accès = bd.access;

      const typeAccès = (accès as AccessController).type;
      if (typeAccès === "ipfs") {
        await fSuivreBd((accès as IPFSAccessController).write);
        await fOublier();
        return faisRien;
      } else if (typeAccès === "contrôleur-constellation") {
        const contrôleurConstellation = accès as ContrôleurConstellation;
        const fFinale = async () => {
          const mods = contrôleurConstellation.gestRôles._rôles[MODÉRATEUR];
          await fSuivreBd(mods);
        };
        contrôleurConstellation.gestRôles.on("misÀJour", fFinale);
        fFinale();
        return async () => {
          contrôleurConstellation.gestRôles.off("misÀJour", fFinale);
          await fOublier();
        };
      } else {
        await fOublier();
        return faisRien;
      }
    };

    const info: {autorisés: string[]; infos: statutDispositif[]; idCompte?: string} = { autorisés: [], infos: []};
    const fFinale = async () => {
      if (!idCompte) return;
      const autorisésEtAcceptés = info.autorisés.filter(id => info.infos.find(i=>i.infoDispositif.idDispositif === id)?.infoDispositif.idCompte === idCompte)
      return await f(autorisésEtAcceptés);
    };

    const fOublierDispositifsAutorisés = await suivreBdDeFonction({
      fRacine: async ({
        fSuivreRacine,
      }: {
        fSuivreRacine: (nouvelIdBdCible?: string | undefined) => Promise<void>;
      }): Promise<schémaFonctionOublier> => {
        if (idCompte) {
          await fSuivreRacine(idCompte);
          return faisRien;
        } else {
          return await this.suivreIdCompte({ f: fSuivreRacine });
        }
      },
      f: ignorerNonDéfinis(async (x: string[]) => { info.autorisés = x; return await fFinale()}),
      fSuivre: async ({id, fSuivreBd}: {id: string; fSuivreBd: schémaFonctionSuivi<string[] | undefined>}) => {info.idCompte = id; return await fSuivi({id, fSuivreBd})},
    });
    const fOublierInfosDispositifs = await this.réseau.suivreConnexionsDispositifs({f: async x => {info.infos = x; return await fFinale()}})
    return async () => {await Promise.all([fOublierDispositifsAutorisés(), fOublierInfosDispositifs()])};
  }

  async nommerDispositif({
    idDispositif,
    nom,
    type,
  }: {
    idDispositif?: string;
    nom?: string;
    type?: string;
  }): Promise<void> {
    const idDispositifFinal = idDispositif || (await this.obtIdDispositif());

    const idBdNomsDispositifs = await this.obtIdBd({
      nom: "nomsDispositifs",
      racine: await this.obtIdCompte(),
      type: "keyvalue",
    });
    const { bd: bdNomsDispositifs, fOublier } = await this.ouvrirBdTypée({
      id: idBdNomsDispositifs!,
      type: "keyvalue",
      schéma: schémaStructureNomsDispositifs,
    });
    if (nom || type) {
      const val: { nom?: string; type?: string } = {};
      if (nom) val.nom = nom;
      if (type) val.type = type;
      await bdNomsDispositifs.set(idDispositifFinal, val);
    } else {
      await bdNomsDispositifs.del(idDispositifFinal);
    }
    await fOublier();
  }

  async suivreNomsDispositifs({
    idCompte,
    f,
  }: {
    idCompte?: string;
    f: schémaFonctionSuivi<structureNomsDispositifs>;
  }): Promise<schémaFonctionOublier> {
    const idCompteFinal = idCompte || (await this.obtIdCompte());
    return await this.suivreBdDicDeClef({
      id: idCompteFinal,
      schéma: schémaStructureNomsDispositifs,
      clef: "nomsDispositifs",
      f,
    });
  }

  async suivreNomDispositif({
    idCompte,
    idDispositif,
    f,
  }: {
    idDispositif: string;
    idCompte?: string;
    f: schémaFonctionSuivi<{ type?: string; nom?: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreNomsDispositifs({
      idCompte,
      f: async (noms) => {
        const nomsDispositif = noms[idDispositif];
        if (nomsDispositif) {
          return await f(nomsDispositif);
        }
      },
    });
  }

  async générerInvitationRejoindreCompte(): Promise<{
    idCompte: string;
    codeSecret: string;
  }> {
    const idCompte = await this.obtIdCompte();
    const codeSecret = bs58.encode(randomBytes(6 * 3)).slice(0, 6);
    this.motsDePasseRejoindreCompte[codeSecret] = Date.now();
    const idDispositif = await this.obtIdDispositif();
    return { idCompte, codeSecret: `${idDispositif}:${codeSecret}` };
  }

  async révoquerInvitationRejoindreCompte({
    codeSecret,
  }: {
    codeSecret?: string;
  }): Promise<void> {
    if (codeSecret) {
      const codeSecretOriginal = codeSecret.split(":")[1];
      delete this.motsDePasseRejoindreCompte[codeSecretOriginal];
    } else {
      this.motsDePasseRejoindreCompte = {};
    }
  }

  async considérerRequêteRejoindreCompte({
    requête,
  }: {
    requête: ContenuMessageRejoindreCompte;
  }): Promise<void> {
    const { idDispositif, empreinteVérification } = requête;
    const maintenant = Date.now();

    for (const codeSecret of Object.keys(this.motsDePasseRejoindreCompte)) {
      const dateCodeSecret = this.motsDePasseRejoindreCompte[codeSecret];
      const dateValide =
        maintenant - dateCodeSecret < DÉLAI_EXPIRATION_INVITATIONS;
      if (dateValide) {
        const empreinteCorrespondante = this.empreinteInvitation({
          idDispositif,
          codeSecret,
        });
        if (empreinteCorrespondante === empreinteVérification) {
          // Empreinte code secret validé
          delete this.motsDePasseRejoindreCompte[codeSecret];
          await this.ajouterDispositif({ idDispositif });
        }
      }
    }
  }

  empreinteInvitation({
    idDispositif,
    codeSecret,
  }: {
    idDispositif: string;
    codeSecret: string;
  }): string {
    return Base64.stringify(sha256(idDispositif + codeSecret));
  }

  async demanderEtPuisRejoindreCompte({
    idCompte,
    codeSecret,
  }: {
    idCompte: string;
    codeSecret: string;
  }): Promise<void> {
    await this.réseau.envoyerDemandeRejoindreCompte({
      codeSecret,
    });
    await this.rejoindreCompte({
      idCompte,
    });
  }

  async ajouterDispositif({
    idDispositif,
  }: {
    idDispositif: string;
  }): Promise<void> {
    const { idCompte } = await this.attendreInitialisée();

    const { bd: bdCompte, fOublier } = await this.ouvrirBd({
      id: idCompte,
    });
    const accès = bdCompte.access as ContrôleurConstellation;
    accès.grant(MODÉRATEUR, idDispositif);
    await fOublier();
  }

  async enleverDispositif({
    idDispositif,
  }: {
    idDispositif: string;
  }): Promise<void> {
    const { idCompte } = await this.attendreInitialisée();

    const { bd: bdCompte, fOublier } = await this.ouvrirBd({
      id: idCompte,
    });
    const accès = bdCompte.access as ContrôleurConstellation;
    await accès.revoke(MODÉRATEUR, idDispositif);
    await fOublier();
  }

  async rejoindreCompte({ idCompte }: { idCompte: string }): Promise<void> {
    if (!isValidAddress(idCompte)) {
      throw new Error(`Adresse compte "${idCompte}" non valide`);
    }

    // Attendre de recevoir la permission d'écrire à idCompte
    const { bd, fOublier } = await this.ouvrirBdTypée({
      id: idCompte,
      type: "keyvalue",
      schéma: schémaStructureBdCompte,
    });
    const accès = bd.access as ContrôleurConstellation;
    const moi = await this.obtIdDispositif();

    let oublierPermission: schémaFonctionOublier;
    await new Promise<void>((résoudre) => {
      accès
        .suivreIdsOrbiteAutoriséesÉcriture((autorisés: string[]) => {
          const autorisé = autorisés.includes(moi);
          if (autorisé) {
            oublierPermission().then(fOublier).then(résoudre);
          }
        })
        .then((x) => (oublierPermission = x));
    });

    // Là on peut y aller
    this.idCompte = idCompte;
    await this.sauvegarderAuStockageLocal({
      clef: "idCompte",
      val: idCompte,
      parCompte: false,
    });

    this.événements.emit("comptePrêt", { idCompte });
  }

  async donnerAccès({
    idBd,
    identité,
    rôle = MEMBRE,
  }: {
    idBd: string;
    identité: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    if (!isValidAddress(identité)) {
      throw new Error(`Identité "${identité}" non valide.`);
    }

    const { bd, fOublier } = await this.ouvrirBd({ id: idBd });
    const accès = bd.access;
    const typeAccès = (accès as AccessController).type;
    if (typeAccès === nomTypeContrôleurConstellation) {
      await (accès as ContrôleurConstellation).grant(rôle, identité);
    }
    await fOublier();
  }

  @cacheSuivi
  async suivreIdCompte({
    f,
  }: {
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async ({ idCompte }: { idCompte: string }) => {
      await f(idCompte);
    };
    this.événements.on("comptePrêt", fFinale);
    if (this.idCompte) await fFinale({ idCompte: this.idCompte });

    return async () => {
      this.événements.off("comptePrêt", fFinale);
    };
  }

  async obtIdLibp2p(): Promise<string> {
    const { sfip } = await this.attendreSfipEtOrbite();
    return sfip.libp2p.peerId.toString();
  }

  async obtIdDispositif(): Promise<string> {
    const { orbite } = await this.attendreSfipEtOrbite();
    return orbite.identity.id;
  }

  async obtIdentitéOrbite(): Promise<OrbitDB["identity"]> {
    const { orbite } = await this.attendreSfipEtOrbite();
    return orbite.identity;
  }

  async obtIdCompte(): Promise<string> {
    const { idCompte } = await this.attendreInitialisée();
    return idCompte;
  }

  async copierContenuBdDic<
    T extends { [clef: string]: élémentsBd } & Record<C, string>,
    C extends string,
    U extends { [clef: string]: élémentsBd },
  >({
    bdBase,
    nouvelleBd,
    clef,
    schéma,
  }: {
    bdBase: TypedKeyValue<T>;
    nouvelleBd: TypedKeyValue<T>;
    clef: C;
    schéma: JSONSchemaType<U>;
  }): Promise<void> {
    const idBdDicInit = await bdBase.get(clef);

    if (typeof idBdDicInit !== "string") return;

    const { bd: bdDicInit, fOublier: fOublierInit } = await this.ouvrirBdTypée({
      id: idBdDicInit,
      type: "keyvalue",
      schéma,
    });

    const idNouvelleBdDic = await nouvelleBd.get(clef);
    if (!idNouvelleBdDic) throw new Error("La nouvelle BD n'existait pas.");
    if (typeof idNouvelleBdDic !== "string")
      throw new Error(`${idNouvelleBdDic} n'est pas une adresse Orbite.`);

    const { bd: nouvelleBdDic, fOublier: fOublierNouvelle } =
      await this.ouvrirBdTypée({
        id: idNouvelleBdDic,
        type: "keyvalue",
        schéma,
      });

    const données = await bdDicInit.all();

    await Promise.all(
      données.map(async (d) => {
        await nouvelleBdDic.put(d.key, d.value);
      }),
    );
    fOublierInit();
    fOublierNouvelle();
  }

  async combinerBds({
    idBdBase,
    idBd2,
  }: {
    idBdBase: string;
    idBd2: string;
  }): Promise<void> {
    // Extraire le type
    const { bd, fOublier } = await this.ouvrirBd({ id: idBdBase });
    const type = bd.type;
    await fOublier();

    // Un peu dupliqué, à cause de TypeScript
    switch (type) {
      case "keyvalue": {
        const { bd: bdBase, fOublier: fOublierBase } = await this.ouvrirBd({
          id: idBdBase,
          type: "keyvalue",
        });
        const { bd: bd2, fOublier: fOublier2 } = await this.ouvrirBd({
          id: idBd2,
          type: "keyvalue",
        });
        await this.combinerBdsDict({
          bdBase,
          bd2,
        });
        await fOublierBase();
        await fOublier2();
        break;
      }
      case "set": {
        const { bd: bdBase, fOublier: fOublierBase } = await this.ouvrirBd({
          id: idBdBase,
          type: "set",
        });
        const { bd: bd2, fOublier: fOublier2 } = await this.ouvrirBd({
          id: idBd2,
          type: "set",
        });
        await this.combinerBdsEnsemble({
          bdBase,
          bd2,
        });
        await fOublierBase();
        await fOublier2();
        break;
      }

      default:
        throw new Error(`Type de BD ${type} non supporté.`);
    }
  }

  async combinerBdsDict({
    bdBase,
    bd2,
  }: {
    bdBase: KeyValueDatabase;
    bd2: KeyValueDatabase;
  }): Promise<void>;
  async combinerBdsDict<T extends { [clef: string]: unknown }>({
    bdBase,
    bd2,
  }: {
    bdBase: TypedKeyValue<T>;
    bd2: TypedKeyValue<T>;
  }): Promise<void>;
  async combinerBdsDict<T extends { [clef: string]: unknown }>({
    bdBase,
    bd2,
  }: {
    bdBase: TypedKeyValue<T> | KeyValueDatabase;
    bd2: TypedKeyValue<T> | KeyValueDatabase;
  }): Promise<void> {
    const contenuBd2 = Object.fromEntries(
      (await bd2.all()).map((x) => [x.key, x.value]),
    );

    for (const [c, v] of Object.entries(contenuBd2)) {
      const valBdBase = await bdBase.get(c);
      if (valBdBase === v) {
        continue;
      } else if (valBdBase === undefined) {
        await bdBase.put(c, v as T[typeof c]);
      } else if (isValidAddress(valBdBase) && isValidAddress(v)) {
        await this.combinerBds({
          idBdBase: valBdBase as string,
          idBd2: v as string,
        });
      }
    }
  }

  async combinerBdsEnsemble<T extends élémentsBd>({
    bdBase,
    bd2,
  }: {
    bdBase: TypedSet<T> | SetDatabaseType;
    bd2: TypedSet<T> | SetDatabaseType;
  }): Promise<void>;
  async combinerBdsEnsemble<T extends { [key: string]: élémentsBd }>({
    bdBase,
    bd2,
    index,
  }: {
    bdBase: TypedSet<T> | SetDatabaseType;
    bd2: TypedSet<T> | SetDatabaseType;
    index: string[];
  }): Promise<void>;
  async combinerBdsEnsemble<
    T extends élémentsBd | { [key: string]: élémentsBd },
  >({
    bdBase,
    bd2,
    index,
  }: {
    bdBase:
      | TypedSet<{ [key: string]: élémentsBd } | élémentsBd>
      | SetDatabaseType;
    bd2: TypedSet<{ [key: string]: élémentsBd } | élémentsBd> | SetDatabaseType;
    index?: string[];
  }): Promise<void> {
    const contenuBdBase = await bdBase.all();
    const contenuBd2 = await bd2.all();

    for (const é of contenuBd2) {
      const valBd2 = é.value as T; // Note : peut-être existe-t-il une solution plus sécuritaire ?

      if (index) {
        if (typeof valBd2 !== "object")
          throw new Error(`Erreur combinaison ensembles : ${typeof valBd2}`);
        const existant = contenuBdBase.find(
          (x) =>
            typeof x.value === "object" &&
            index.every(
              (i) =>
                (x.value as Record<string, unknown>)[i] ===
                (valBd2 as Record<string, unknown>)[i],
            ),
        );

        if (!existant) {
          // Si pas d'existant, ajouter le nouvel élément
          await bdBase.add(valBd2);
        } else {
          const valExistant = existant.value;

          // Si existant, combiner et mettre à jour seulement si différents
          if (!deepEqual(valExistant, valBd2)) {
            const combiné = Object.assign({}, valExistant) as {
              [clef: string]: élémentsBd;
            };
            for (const [c, v] of Object.entries(valBd2)) {
              if (combiné[c] === undefined) {
                combiné[c] = v;
              } else if (!deepEqual(combiné[c], v)) {
                if (isValidAddress(combiné[c]) && isValidAddress(v)) {
                  await this.combinerBds({
                    idBdBase: combiné[c] as string,
                    idBd2: v as string,
                  });
                }
              }
            }
            await bdBase.del(existant.value as T);
            await bdBase.add(combiné);
          }
        }
      } else {
        if (!contenuBdBase.some((x) => deepEqual(x.value, valBd2))) {
          await bdBase.add(valBd2);
        }
      }
    }
  }

  async suivreBd<
    U extends { [clef: string]: élémentsBd },
    T extends TypedKeyValue<U> = TypedKeyValue<U>,
  >({
    id,
    f,
    type,
    schéma,
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type: "keyvalue";
    schéma?: JSONSchemaType<U>;
  }): Promise<schémaFonctionOublier>;
  async suivreBd<U extends élémentsBd = élémentsBd, T = TypedSet<U>>({
    id,
    f,
    type,
    schéma,
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type: "set";
    schéma?: JSONSchemaType<U>;
  }): Promise<schémaFonctionOublier>;
  async suivreBd<
    U extends { [clef: string]: élémentsBd },
    T = TypedOrderedKeyValue<U>,
  >({
    id,
    f,
    type,
    schéma,
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type: "ordered-keyvalue";
    schéma?: JSONSchemaType<U>;
  }): Promise<schémaFonctionOublier>;
  async suivreBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<Store>;
  }): Promise<schémaFonctionOublier>;
  async suivreBd<U, T extends Store>({
    id,
    f,
    type,
    schéma,
  }: {
    id: string;
    f: schémaFonctionSuivi<T>;
    type?: "keyvalue" | "set" | "ordered-keyvalue";
    schéma?: JSONSchemaType<U>;
  }): Promise<schémaFonctionOublier> {
    if (!isValidAddress(id)) throw new Error(`Adresse "${id}" non valide.`);
    const fsOublier: schémaFonctionOublier[] = [];
    const promesses: { [clef: string]: Promise<void> | void } = {};

    let annulé = false;

    const lancerSuivi = () => {
      // Alambiqué, mais apparemment nécessaire pour TypeScript !
      const promesseBd = schéma
        ? type === "set"
          ? this.ouvrirBdTypée({
              id,
              type,
              schéma: schéma as JSONSchemaType<Extract<U, élémentsBd>>,
            })
          : type === "keyvalue"
            ? this.ouvrirBdTypée({
                id,
                type,
                schéma: schéma as JSONSchemaType<
                  Extract<U, { [clef: string]: élémentsBd }>
                >,
              })
            : type === "ordered-keyvalue"
              ? this.ouvrirBdTypée({
                  id,
                  type,
                  schéma: schéma as JSONSchemaType<
                    Extract<U, { [clef: string]: élémentsBd }>
                  >,
                })
              : this.ouvrirBd({
                  id,
                  type,
                })
        : this.ouvrirBd({
            id,
          });
      promesseBd
        .then(({ bd, fOublier }) => {
          fsOublier.push(fOublier);

          const fFinale = () => {
            const idSuivi = uuidv4();
            const promesse = f(bd as T);

            const estUnePromesse = (x: unknown): x is Promise<void> => {
              return !!x && !!(x as Promise<void>).then;
            };

            if (estUnePromesse(promesse)) {
              promesses[idSuivi] = promesse;
              promesse.then(() => {
                delete promesses[idSuivi];
              });
            }
          };

          bd.events.on("update", fFinale);
          fsOublier.push(async () => {
            bd.events.off("update", fFinale);
          });

          /* if (
            bd.events.listenerCount("update") > bd.events.getMaxListeners()
          ) {
            console.log({id: bd.id, type: bd.type, n: bd.events.listenerCount("update")})
            console.log({f})
          } */

          fFinale();
        })
        .catch(() => {
          // Ceci nous permet de ressayer d'obtenir le contenu de la BD en continue, tant que la requête n'a pas été annulée
          if (!annulé) {
            lancerSuivi();
          }
        });
    };

    lancerSuivi();

    const fOublier = async () => {
      annulé = true;
      await Promise.all(fsOublier.map((f) => f()));
      await Promise.all(Object.values(promesses));
    };
    return fOublier;
  }

  async suivreBdDeClef<T>({
    id,
    clef,
    f,
    fSuivre,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T | undefined>;
    fSuivre: (args: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<T>;
    }) => Promise<schémaFonctionOublier>;
  }): Promise<schémaFonctionOublier> {
    const fRacine = async ({
      fSuivreRacine,
    }: {
      fSuivreRacine: (nouvelIdBdCible: string | undefined) => Promise<void>;
    }): Promise<schémaFonctionOublier> => {
      const fSuivreBdRacine = async (
        bd: TypedKeyValue<Record<typeof clef, string>>,
      ) => {
        const nouvelIdBdCible = await bd.get(clef);
        return await fSuivreRacine(nouvelIdBdCible);
      };
      return await this.suivreBd({ id, f: fSuivreBdRacine, type: "keyvalue" });
    };
    return await suivreBdDeFonction<T>({ fRacine, f, fSuivre });
  }

  async suivreBdDic<T extends { [clef: string]: élémentsBd }>({
    id,
    schéma,
    f,
  }: {
    id: string;
    schéma?: JSONSchemaType<T>;
    f: schémaFonctionSuivi<T>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: KeyValueDatabase) => {
      const valeurs = (
        bd
          ? Object.fromEntries((await bd.all()).map((x) => [x.key, x.value]))
          : {}
      ) as T;
      await f(valeurs);
    };
    // @ts-expect-error Je ne sais pas pourquoi
    return await this.suivreBd({ id, type: "keyvalue", schéma, f: fFinale });
  }

  async suivreBdDicOrdonnée<T extends { [clef: string]: élémentsBd }>({
    id,
    schéma,
    f,
  }: {
    id: string;
    schéma?: JSONSchemaType<T>;
    f: schémaFonctionSuivi<
      {
        key: Extract<keyof T, "string">;
        value: T[keyof T];
        hash: string;
      }[]
    >;
  }): Promise<schémaFonctionOublier> {
    // À faire : différention entre schéma présent ou absent
    const fFinale = async (bd: OrderedKeyValueDatabaseType) => {
      const valeurs = (await bd.all()) as {
        key: Extract<keyof T, "string">;
        value: T[keyof T];
        hash: string;
      }[];
      await f(valeurs);
    };
    return await this.suivreBd({
      id,
      type: "ordered-keyvalue",
      schéma,
      // @ts-expect-error Je ne sais pas pourquoi
      f: fFinale,
    });
  }

  async suivreBdDicDeClef<T extends { [key: string]: élémentsBd }>({
    id,
    clef,
    schéma,
    f,
  }: {
    id: string;
    clef: string;
    schéma: JSONSchemaType<T>;
    f: schémaFonctionSuivi<T>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (valeurs?: T) => {
      await f(valeurs || ({} as T));
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<T>;
    }) => {
      return await this.suivreBdDic({ id, schéma, f: fSuivreBd });
    };
    return await this.suivreBdDeClef({
      id,
      clef,
      f: fFinale,
      fSuivre,
    });
  }

  async suivreBdDicOrdonnéeDeClef<T extends { [clef: string]: élémentsBd }>({
    id,
    clef,
    schéma,
    f,
  }: {
    id: string;
    clef: string;
    schéma: JSONSchemaType<T>;
    f: schémaFonctionSuivi<{ key: string; value: T[keyof T] }[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (valeurs?: { key: string; value: T[keyof T] }[]) => {
      await f(valeurs || []);
    };
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<
        {
          key: string;
          value: T[keyof T];
          hash: string;
        }[]
      >;
    }) => {
      return await this.suivreBdDicOrdonnée({ id, schéma, f: fSuivreBd });
    };
    return await this.suivreBdDeClef({
      id,
      clef,
      f: fFinale,
      fSuivre,
    });
  }

  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<{ value: T; hash: string }[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur: false;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[] | { value: T; hash: string }[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;
  async suivreBdListeDeClef<T extends élémentsBd>({
    id,
    clef,
    f,
    schéma,
    renvoyerValeur = true,
  }: {
    id: string;
    clef: string;
    f: schémaFonctionSuivi<T[] | { value: T; hash: string }[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: boolean;
  }): Promise<schémaFonctionOublier> {
    // À faire : très laid en raison de contraintes Typescript...peut-être existe-il une meilleure façon ?
    if (renvoyerValeur) {
      const fFinale = async (valeurs?: T[]) => {
        await f(valeurs || []);
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<T[]>;
      }) => {
        return await this.suivreBdListe({
          id,
          f: fSuivreBd,
          schéma,
          renvoyerValeur,
        });
      };

      return await this.suivreBdDeClef({
        id,
        clef,
        f: fFinale,
        fSuivre,
      });
    } else {
      const fFinale = async (valeurs?: { value: T; hash: string }[]) => {
        await f(valeurs || []);
      };
      const fSuivre = async ({
        id,
        fSuivreBd,
      }: {
        id: string;
        fSuivreBd: schémaFonctionSuivi<{ value: T; hash: string }[]>;
      }) => {
        return await this.suivreBdListe({
          id,
          f: fSuivreBd,
          schéma,
          renvoyerValeur: false,
        });
      };

      return await this.suivreBdDeClef({
        id,
        clef,
        f: fFinale as unknown as (
          x?: élémentsBd,
        ) => Promise<schémaFonctionOublier>,
        fSuivre: fSuivre as unknown as ({
          id,
          fSuivreBd,
        }: {
          id: string;
          fSuivreBd: schémaFonctionSuivi<élémentsBd[]>;
        }) => Promise<schémaFonctionOublier>,
      });
    }
  }

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    f: schémaFonctionSuivi<T[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: true;
  }): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    schéma,
    renvoyerValeur,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ value: T; hash: string }[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur: false;
  }): Promise<schémaFonctionOublier>;

  async suivreBdListe<T extends élémentsBd>({
    id,
    f,
    schéma,
    renvoyerValeur = true,
  }: {
    id: string;
    f: schémaFonctionSuivi<T[] | { value: T; hash: string }[]>;
    schéma?: JSONSchemaType<T>;
    renvoyerValeur?: boolean;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBd({
      id,
      type: "set",
      schéma,
      f: async (bd) => {
        const éléments = renvoyerValeur
          ? (await bd.all()).map((x) => x.value)
          : await bd.all();
        await f(éléments);
      },
    });
  }

  async suivreTypeObjet({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<
      "motClef" | "variable" | "bd" | "projet" | "nuée" | undefined
    >;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (vals: { [key: string]: string }) => {
      let typeFinal = undefined as
        | "motClef"
        | "variable"
        | "bd"
        | "projet"
        | "nuée"
        | undefined;

      const { type } = vals;
      if (type) {
        typeFinal = ["motClef", "variable", "bd", "projet", "nuée"].includes(
          type,
        )
          ? (type as "motClef" | "variable" | "bd" | "projet" | "nuée")
          : undefined;
      } else {
        if (vals.bds) typeFinal = "projet";
        else if (vals.tableaux) typeFinal = "bd";
        else if (vals.catégorie) typeFinal = "variable";
        else if (vals.nom) typeFinal = "motClef";
      }
      await f(typeFinal);
    };
    type structureObjet = {
      type?: string;
    };
    const schémaObjet: JSONSchemaType<structureObjet> = {
      type: "object",
      properties: {
        type: { type: "string", nullable: true },
      },
      additionalProperties: true,
    };

    const fOublier = await this.suivreBdDic({
      id: idObjet,
      schéma: schémaObjet,
      f: fFinale,
    });
    return fOublier;
  }

  @cacheSuivi
  async suivreEmpreinteTêtesBdRécursive({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const obtTêteBd = async (bd: Store): Promise<string> => {
      const éléments = await bd.log.heads();
      const tête = éléments[éléments.length - 1]?.hash || "";
      return tête;
    };
    const calculerEmpreinte = (texte: string) => Base64.stringify(md5(texte));

    const fFinale = async (têtes: string[]) => {
      await f(calculerEmpreinte(têtes.sort().join()));
    };

    const fListe = async (
      fSuivreRacine: schémaFonctionSuivi<string[]>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsRécursives({
        idBd,
        f: async (bds) => await fSuivreRacine(bds),
      });
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<string>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBd({
        id,
        f: async (bd) => {
          const tête = await obtTêteBd(bd);
          await fSuivreBranche(tête);
        },
      });
    };

    return await suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async suivreBdsDeBdListe<T extends élémentsBd, U, V>({
    id,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    id: string;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      f: schémaFonctionSuivi<U>,
      branche: T,
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: T[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdListe({ id, f: fSuivreRacine });
    };
    return await suivreBdsDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      fRéduction,
      fCode,
    });
  }

  async suivreBdsDeBdDic<T extends élémentsBd, U, V>({
    id,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    id: string;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      f: schémaFonctionSuivi<U>,
      branche: T,
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<schémaFonctionOublier> {
    const fListe = async (
      fSuivreRacine: (éléments: T[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBd({
        id,
        f: async (bd) => {
          return await fSuivreRacine(
            (await bd.all()).map((x) => x.value) as T[],
          );
        },
      });
    };
    return await suivreBdsDeFonctionListe({
      fListe,
      f,
      fBranche,
      fIdBdDeBranche,
      fRéduction,
      fCode,
    });
  }

  async suivreBdsDeFonctionRecherche<T extends élémentsBd, U, V>({
    fListe,
    f,
    fBranche,
    fIdBdDeBranche = (b) => b as string,
    fRéduction = (branches: U[]) =>
      [...new Set(branches.flat())] as unknown as V[],
    fCode = (é) => é as string,
  }: {
    fListe: (
      fSuivreRacine: (éléments: T[]) => Promise<void>,
    ) => Promise<schémaRetourFonctionRechercheParProfondeur>;
    f: schémaFonctionSuivi<V[]>;
    fBranche: (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<U>,
      branche: T,
    ) => Promise<schémaFonctionOublier | undefined>;
    fIdBdDeBranche?: (b: T) => string;
    fRéduction?: schémaFonctionRéduction<U[], V[]>;
    fCode?: (é: T) => string;
  }): Promise<schémaRetourFonctionRechercheParProfondeur> {
    let _fChangerProfondeur: ((p: number) => Promise<void>) | undefined =
      undefined;
    const fChangerProfondeur = async (p: number) => {
      if (_fChangerProfondeur) await _fChangerProfondeur(p);
    };

    const fListeFinale = async (
      fSuivreRacine: (éléments: T[]) => Promise<void>,
    ): Promise<schémaFonctionOublier> => {
      const { fOublier: fOublierL, fChangerProfondeur: fChangerL } =
        await fListe(fSuivreRacine);
      _fChangerProfondeur = fChangerL;
      return fOublierL;
    };

    const fOublier = await suivreBdsDeFonctionListe({
      fListe: fListeFinale,
      f,
      fBranche,
      fIdBdDeBranche,
      fRéduction,
      fCode,
    });
    return { fOublier, fChangerProfondeur };
  }

  async suivreBdSelonCondition({
    fRacine,
    fCondition,
    f,
  }: {
    fRacine: (
      fSuivreRacine: (id: string) => Promise<void>,
    ) => Promise<schémaFonctionOublier>;
    fCondition: (
      id: string,
      fSuivreCondition: schémaFonctionSuivi<boolean>,
    ) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<string>;
  }): Promise<schémaFonctionOublier> {
    const fSuivre = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string | undefined>;
    }): Promise<schémaFonctionOublier> => {
      return await fCondition(id, async (condition) => {
        fSuivreBd(condition ? id : undefined);
      });
    };
    return await suivreBdDeFonction({
      fRacine: async ({ fSuivreRacine }) => await fRacine(fSuivreRacine),
      f: ignorerNonDéfinis(f),
      fSuivre,
    });
  }

  async suivreBdsSelonCondition<
    T extends
      | schémaFonctionOublier
      | ({ fOublier: schémaFonctionOublier } & { [key: string]: unknown }),
  >({
    fListe,
    fCondition,
    f,
  }: {
    fListe: (fSuivreRacine: (ids: string[]) => Promise<void>) => Promise<T>;
    fCondition: (
      id: string,
      fSuivreCondition: schémaFonctionSuivi<boolean>,
    ) => Promise<schémaFonctionOublier>;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<T> {
    interface branche {
      id: string;
      état: boolean;
    }

    const fFinale = async (éléments: branche[]) => {
      const bdsRecherchées = éléments
        .filter((él) => él.état)
        .map((él) => él.id);
      return await f(bdsRecherchées);
    };

    const fBranche = async (
      id: string,
      fSuivreBranche: schémaFonctionSuivi<branche>,
    ): Promise<schémaFonctionOublier> => {
      const fFinaleSuivreBranche = async (état: boolean) => {
        return await fSuivreBranche({ id, état });
      };
      return await fCondition(id, fFinaleSuivreBranche);
    };

    return await suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
    });
  }

  async obtFichierSFIP({
    id,
    max,
  }: {
    id: string;
    max?: number;
  }): Promise<Uint8Array | null> {
    return await toBuffer(await this.obtItérableAsyncSFIP({ id }), max);
  }

  async obtItérableAsyncSFIP({
    id,
  }: {
    id: string;
  }): Promise<AsyncIterable<Uint8Array>> {
    const { sfip } = await this.attendreSfipEtOrbite();
    const fs = unixfs(sfip);
    const idc = id.split("/")[0];
    return fs.cat(CID.parse(idc));
  }

  async ajouterÀSFIP({
    contenu,
    nomFichier,
  }: {
    contenu: Uint8Array;
    nomFichier: string;
  }): Promise<string> {
    const { sfip } = await this.attendreSfipEtOrbite();
    const fs = unixfs(sfip);
    const idc = await fs.addFile({ content: contenu });
    return idc.toString() + "/" + nomFichier;
  }

  async obtClefStockageClient({
    clef,
    parCompte = true,
  }: {
    clef: string;
    parCompte?: boolean;
  }): Promise<string> {
    if (parCompte) {
      const idCompte = await this.obtIdCompte();
      return `${idCompte.slice(idCompte.length - 23, idCompte.length - 8)} : ${clef}`;
    }
    return clef;
  }

  async obtDeStockageLocal({
    clef,
    parCompte = true,
  }: {
    clef: string;
    parCompte?: boolean;
  }): Promise<string | null> {
    const clefClient = await this.obtClefStockageClient({ clef, parCompte });

    return (await stockageLocal(await this.dossier())).getItem(clefClient);
  }

  async sauvegarderAuStockageLocal({
    clef,
    val,
    parCompte = true,
  }: {
    clef: string;
    val: string;
    parCompte?: boolean;
  }): Promise<void> {
    const clefClient = await this.obtClefStockageClient({ clef, parCompte });
    return (await stockageLocal(await this.dossier())).setItem(clefClient, val);
  }

  async effacerDeStockageLocal({
    clef,
    parCompte = true,
  }: {
    clef: string;
    parCompte: boolean;
  }): Promise<void> {
    const clefClient = await this.obtClefStockageClient({ clef, parCompte });

    return (await stockageLocal(await this.dossier())).removeItem(clefClient);
  }

  async obtIdBd<K extends string>({
    nom,
    racine,
    type,
  }: {
    nom: K;
    racine:
      | string
      | TypedKeyValue<
          Partial<{ [k in K]: string } & { [clef: string]: unknown }>
        >;
    type?: "feed" | "keyvalue" | "ordered-keyvalue" | "set";
  }): Promise<string | undefined> {
    const schémaBdRacine: JSONSchemaType<
      { [k in K]: string } & { [clef: string]: élémentsBd }
    > = {
      type: "object",
      properties: {
        [nom]: { type: "string" },
      },
      additionalProperties: true,
      required: [],
    };

    if (typeof racine === "string" && !adresseOrbiteValide(racine)) {
      throw new Error(`Adresse ${racine} non valide.`);
    }

    const { bd: bdRacine, fOublier } =
      typeof racine === "string"
        ? await this.ouvrirBdTypée({
            id: racine,
            type: "keyvalue",
            schéma: schémaBdRacine,
          })
        : { bd: racine, fOublier: faisRien };

    const clefRequête = bdRacine.address + ":" + nom;
    await this.verrouObtIdBd.acquire(clefRequête);

    let idBd = (await bdRacine.get(nom)) as string | undefined;

    const idBdPrécédente = await this.obtDeStockageLocal({ clef: clefRequête });

    if (typeof idBd === "string" && idBdPrécédente && idBd !== idBdPrécédente) {
      try {
        await this.combinerBds({
          idBdBase: idBd,
          idBd2: idBdPrécédente,
        });

        await this.effacerBd({ id: idBdPrécédente });
        await this.sauvegarderAuStockageLocal({ clef: clefRequête, val: idBd });
      } catch {
        // Rien à faire ; on démissionne !
      }
    }

    // Nous devons confirmer que la base de données spécifiée était du bon genre
    if (typeof idBd === "string" && type) {
      try {
        const { fOublier: fOublierBd } = await this.ouvrirBd({
          id: idBd,
          type,
        });
        await fOublierBd();

        this.verrouObtIdBd.release(clefRequête);
        return idBd;
      } catch {
        this.verrouObtIdBd.release(clefRequête);
        throw new Error("Bd n'existe pas : " + nom + " " + idBd);
      }
    }

    if (!idBd && type) {
      const accès = bdRacine.access as ContrôleurConstellation;

      const { orbite } = await this.attendreSfipEtOrbite();

      const permission = await accès.estAutorisé(orbite.identity.id);

      if (permission) {
        const optionsAccès = await this.obtOpsAccès({
          idBd: bdRacine.address,
        });
        idBd = await this.créerBdIndépendante({ type, optionsAccès });
        if (!idBd) throw new Error("Bd non générée");

        // @ts-expect-error  Aucune idée pourquoi ça fonctionne pas
        await bdRacine.set(nom, idBd);
      }
    }

    if (typeof idBd === "string")
      await this.sauvegarderAuStockageLocal({ clef: clefRequête, val: idBd });

    if (fOublier) await fOublier();

    this.verrouObtIdBd.release(clefRequête);
    return typeof idBd === "string" ? idBd : undefined;
  }

  async créerBdIndépendante({
    type,
    optionsAccès,
    nom,
  }: {
    type: "feed" | "set" | "keyvalue" | "ordered-keyvalue";
    optionsAccès?: OptionsContrôleurConstellation;
    nom?: string;
  }): Promise<string> {
    const { orbite } = await this.attendreSfipEtOrbite();
    optionsAccès = optionsAccès || (await this.obtOptionsAccès());

    return await orbite.créerBdIndépendante({
      type,
      nom,
      options: {
        AccessController: générerContrôleurConstellation(optionsAccès),
      },
    });
  }

  async effacerBd({ id }: { id: string }): Promise<void> {
    return await this.orbite?.effacerBd({ id });
  }

  async obtOpsAccès({
    idBd,
  }: {
    idBd: string;
  }): Promise<OptionsContrôleurConstellation> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idBd });
    const accès = bd.access as ContrôleurConstellation;

    await fOublier();
    return {
      address: accès.bd.address,
      write: accès.write,
    };
  }

  @cacheSuivi
  async suivrePermission({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<(typeof rôles)[number] | undefined>;
  }): Promise<schémaFonctionOublier> {
    const { bd, fOublier } = await this.ouvrirBd({ id: idObjet });
    const accès = bd.access;
    const typeAccès = accès.type;

    if (typeAccès === "ipfs") {
      const moi = await this.obtIdDispositif();
      await f(
        (accès as IPFSAccessController).write.includes(moi)
          ? MEMBRE
          : undefined,
      );
      await fOublier();
      return faisRien;
    } else if (typeAccès === nomTypeContrôleurConstellation) {
      const fFinale = async (utilisateurs: infoUtilisateur[]) => {
        const mesRôles = utilisateurs
          .filter((u) => u.idCompte === this.idCompte)
          .map((u) => u.rôle);
        const rôlePlusPuissant = mesRôles.includes(MODÉRATEUR)
          ? MODÉRATEUR
          : mesRôles.includes(MEMBRE)
            ? MEMBRE
            : undefined;
        await f(rôlePlusPuissant);
      };
      const fOublierSuivreAccès = await (
        accès as ContrôleurConstellation
      ).suivreUtilisateursAutorisés(fFinale);
      return async () => {
        await fOublierSuivreAccès();
        await fOublier();
      };
    } else {
      throw new Error(`Type d'accès ${typeAccès} non reconnu.`);
    }
  }

  @cacheSuivi
  async suivrePermissionÉcrire({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<boolean>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (rôle?: (typeof rôles)[number]) => {
      await f(rôle !== undefined);
    };
    return await this.suivrePermission({ idObjet: id, f: fFinale });
  }

  @cacheSuivi
  async suivreAccèsBd({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<infoAccès[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (bd: Store) => {
      const accès = bd.access;
      const typeAccès = (accès as AccessController).type;
      if (typeAccès === "ipfs") {
        const listeAccès: infoAccès[] = (
          accès as IPFSAccessController
        ).write.map((id) => {
          return {
            idCompte: id,
            rôle: MODÉRATEUR,
          };
        });
        await f(listeAccès);
      } else if (typeAccès === nomTypeContrôleurConstellation) {
        const fOublierAutorisés = await (
          accès as ContrôleurConstellation
        ).suivreUtilisateursAutorisés(f);
        return fOublierAutorisés;
      }
      return faisRien;
    };
    return await this.suivreBd({
      id,
      f: fFinale,
    });
  }

  @cacheSuivi
  async suivreBdsRécursives({
    idBd,
    f,
  }: {
    idBd: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const dicBds: {
      [key: string]: {
        requêtes: Set<string>;
        sousBds: string[];
        fOublier: schémaFonctionOublier;
      };
    } = {};

    const fFinale = async () => {
      await f(Object.keys(dicBds));
    };

    const verrou = new Semaphore();

    const enleverRequêtesDe = async (de: string) => {
      delete dicBds[de];
      await Promise.all(
        Object.keys(dicBds).map(async (id) => {
          if (!dicBds[id]) return;
          dicBds[id].requêtes.delete(de);
          if (!dicBds[id].requêtes.size) {
            await dicBds[id].fOublier();
          }
        }),
      );
    };

    // On ne suit pas automatiquement les BDs ou tableaux dont celui d'intérêt a été copié...ça pourait être très volumineu
    const clefsÀExclure = ["copiéDe"];

    const _suivreBdsRécursives = async (
      id: string,
      de: string,
    ): Promise<void> => {
      const extraireÉléments = (l_vals: élémentsBd[]): string[] => {
        return l_vals
          .map((v) => {
            if (typeof v === "string") return [v];
            if (Array.isArray(v)) return v;
            if (typeof v === "object") return Object.values(v);
            return [];
          })
          .flat()
          .filter((v) => isValidAddress(v)) as string[];
      };

      const fSuivreBd = async (
        vals: { [clef: string]: élémentsBd } | élémentsBd[],
      ) => {
        // Cette fonction détectera les éléments d'une liste ou d'un dictionnaire
        // (à un niveau de profondeur) qui représentent une adresse de BD Orbit.
        let idsOrbite: string[] = [];

        if (typeof vals === "object") {
          idsOrbite = extraireÉléments(
            Object.entries(vals)
              .filter((x) => !clefsÀExclure.includes(x[0]))
              .map((x) => x[1]),
          );
          idsOrbite.push(...extraireÉléments(Object.keys(vals)));
        } else if (Array.isArray(vals)) {
          idsOrbite = extraireÉléments(vals);
        } else if (typeof vals === "string") {
          idsOrbite = [vals];
        }
        const nouvelles = idsOrbite.filter(
          (id_) => !dicBds[id].sousBds.includes(id_),
        );
        const obsolètes = dicBds[id].sousBds.filter(
          (id_) => !idsOrbite.includes(id_),
        );

        dicBds[id].sousBds = idsOrbite;

        await Promise.all(
          obsolètes.map(async (o) => {
            dicBds[o]?.requêtes.delete(id);
            if (!dicBds[o]?.requêtes.size) await dicBds[o]?.fOublier();
          }),
        );
        await Promise.all(
          nouvelles.map(async (id_) => await _suivreBdsRécursives(id_, id)),
        );
        fFinale();
      };

      await verrou.acquire(id);
      if (dicBds[id]) {
        dicBds[id].requêtes.add(de);
        return;
      }

      const { bd, fOublier } = await this.ouvrirBd({ id });
      const { type } = bd;
      await fOublier();

      dicBds[id] = {
        requêtes: new Set([de]),
        sousBds: [],
        fOublier: async () => {
          await fOublierSuiviBd();
          await enleverRequêtesDe(id);
        },
      };

      let fOublierSuiviBd: schémaFonctionOublier;
      if (type === "keyvalue") {
        fOublierSuiviBd = await this.suivreBdDic({ id, f: fSuivreBd });
      } else if (type === "ordered-keyvalue") {
        fOublierSuiviBd = await this.suivreBdDicOrdonnée({ id, f: fSuivreBd });
      } else if (type === "set") {
        fOublierSuiviBd = await this.suivreBdListe({ id, f: fSuivreBd });
      } else {
        fOublierSuiviBd = faisRien; // Rien à suivre mais il faut l'inclure quand même !
      }

      verrou.release(id);
      fFinale();
    };

    await _suivreBdsRécursives(idBd, "");

    const fOublier = async () => {
      await Promise.all(Object.values(dicBds).map((v) => v.fOublier()));
    };
    return fOublier;
  }

  async fermerCompte(): Promise<void> {
    if (this.réseau) await this.réseau.fermer();
    if (this.favoris) await this.favoris.fermer();

    if (this.automatisations) await this.automatisations.fermer();
  }

  async fermer(): Promise<void> {
    await this.attendreInitialisée();
    const { orbite } = await this.attendreSfipEtOrbite();
    this.signaleurArrêt.abort();

    await (await stockageLocal(await this.dossier())).fermer?.();
    await this.fermerCompte();
    await this.épingles.fermer();

    await orbite.fermer({ arrêterOrbite: !this._orbiteExterne });
    if (this.sfip && !this._sfipExterne) {
      await this.sfip.stop();
      await this.sfip.libp2p.stop();
    }

    // Effacer fichier verrou
    await this.effacerVerrou();
  }

  async effacerDispositif(): Promise<void> {
    await this.fermer();
    if (indexedDB) {
      if (indexedDB.databases) {
        const indexedDbDatabases = await indexedDB.databases();
        await Promise.all(
          indexedDbDatabases.map((bd) => {
            if (bd.name) indexedDB.deleteDatabase(bd.name);
          }),
        );
      } else {
        console.warn("On a pas pu tout effacer.");
      }
    } else {
      const fs = await import("fs");
      const stockageLocal_ = await stockageLocal(await this.dossier());
      stockageLocal_.clear();
      fs.rmdirSync(await this.dossier());
    }
  }

  async exporterDispositif({
    nomFichier,
  }: {
    nomFichier: string;
  }): Promise<void> {
    if (isNode || isElectronMain) {
      const fs = await import("fs");
      const path = await import("path");

      const ajouterDossierÀZip = ({
        dossier,
        zip,
      }: {
        dossier: string;
        zip: JSZip;
      }): void => {
        const dossiers = fs.readdirSync(dossier);
        dossiers.map((d) => {
          const stat = fs.statSync(d);
          if (stat?.isDirectory()) {
            ajouterDossierÀZip({
              dossier: path.join(dossier, d),
              zip: zip.folder(d)!,
            });
          } else {
            const fluxFichier = fs.createReadStream(path.join(dossier, d));
            zip.file(d, fluxFichier);
          }
        });
      };
      const zip = new JSZip();
      ajouterDossierÀZip({
        dossier: await this.dossier(),
        zip,
      });
      await sauvegarderFichierZip({ fichierZip: zip, nomFichier });
    } else if (indexedDB?.databases) {
      const sauvegarderBdIndexeÀZip = ({
        bd,
        zip,
      }: {
        bd: IDBDatabaseInfo;
        zip: JSZip;
      }) => {
        const { name: nomBd } = bd;
        if (nomBd) {
          const dossierZipBd = zip.folder(nomBd);
          if (!dossierZipBd) throw new Error(nomBd);
          const bdOuverte = indexedDB.open(nomBd).result;
          const tableauxBdIndexe = bdOuverte.objectStoreNames;
          const listeTableaux = [...Array(tableauxBdIndexe.length).keys()]
            .map((i) => tableauxBdIndexe.item(i))
            .filter((x) => !!x) as string[];
          listeTableaux.map((tbl) =>
            dossierZipBd.file(
              tbl,
              new indexedDbStream.IndexedDbReadStream({
                databaseName: nomBd,
                objectStoreName: tbl,
              }),
            ),
          );
        }
      };
      const fichierZip = new JSZip();

      const indexedDbDatabases = await indexedDB.databases();
      const dossierZipIndexe = fichierZip.folder("bdIndexe");
      if (!dossierZipIndexe) throw new Error("Erreur Bd Indexe...");
      indexedDbDatabases.forEach((bd) => {
        sauvegarderBdIndexeÀZip({ bd, zip: dossierZipIndexe });
      });
      fichierZip.file(
        "stockageLocal",
        JSON.stringify(await exporterStockageLocal(await this.dossier())),
      );

      await sauvegarderFichierZip({ fichierZip, nomFichier });
    } else {
      throw new Error("Sauvegarde non implémentée.");
    }
  }

  async rétablirDispositif(): Promise<void> {
    await this.effacerDispositif();

    if (isNode || isElectronMain) {
      throw new Error("Non implémenté");
    } else {
      throw new Error("Non implémenté");
    }
  }

  static async créer<T extends ServicesLibp2p = ServicesLibp2p>(
    opts: optsConstellation<T> = {},
  ): Promise<Constellation<T>> {
    const client = new Constellation(opts);
    await client.attendreInitialisée();
    return client;
  }
}
