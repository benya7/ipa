import { isElectronMain, isNode } from "wherearewe";

import { JSONSchemaType } from "ajv";
import { suivreBdsDeFonctionListe } from "@constl/utils-ipa";
import deepEqual from "deep-equal";
import { cacheSuivi } from "@/décorateursCache.js";
import { ComposanteClientDic } from "./composanteClient.js";
import { effacerPropriétésNonDéfinies } from "./utils.js";
import type { Constellation } from "@/client.js";
import type { schémaFonctionOublier, schémaFonctionSuivi } from "@/types.js";

export type typeDispositifs = string | string[] | "TOUS" | "INSTALLÉ" | "AUCUN";

export type BooléenniserPropriétés<T extends object> = {[clef in keyof T]: T[clef] extends object ? BooléenniserPropriétés<T[clef]> : boolean}

export type ÉpingleFavoris =
  | ÉpingleVariable
  | ÉpingleMotClef
  | ÉpingleBd
  | ÉpingleNuée
  | ÉpingleProjet
  | ÉpingleCompte
  | ÉpingleProfil;

export type BaseÉpingleFavoris = {
  base?: typeDispositifs;
};

export type ÉpingleBd = BaseÉpingleFavoris & {
  type: "bd";
  fichiersBase?: typeDispositifs;
  données?: {
    tableaux?: typeDispositifs;
    fichiers?: typeDispositifs;
  };
};

export type ÉpingleNuée = BaseÉpingleFavoris & {
  type: "nuée";
  fichiersBase?: typeDispositifs;
  données?: ÉpingleBd;
};

export type ÉpingleVariable = BaseÉpingleFavoris & {
  type: "variable";
};

export type ÉpingleMotClef = BaseÉpingleFavoris & {
  type: "motClef";
};

export type ÉpingleProjet = BaseÉpingleFavoris & {
  type: "projet";
  fichiersBase?: typeDispositifs;
  bds?: ÉpingleBd;
};

export type ÉpingleProfil = BaseÉpingleFavoris & {
  type: 'profil';
  fichiers?: typeDispositifs;
}

export type ÉpingleCompte = BaseÉpingleFavoris & {
  type: "compte";
  profil?: ÉpingleProfil
  favoris?: typeDispositifs
};

export type ÉpingleFavorisAvecId<T extends ÉpingleFavoris = ÉpingleFavoris> = {
  idObjet: string;
  épingle: T;
};

const schémaTypeDispositif: JSONSchemaType<typeDispositifs> = {
  type: ["string", "array"],
  anyOf: [
    {
      type: "string",
    },
    {
      type: "array",
      items: {type: "string"},
    },
  ],
  nullable: true,
}

const schémaÉpingleVariable: JSONSchemaType<ÉpingleVariable> =  {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "variable"
    },
    base: {
      type: ["string", "array"],
      anyOf: [
        {
          type: "string"
        },
        {
          type: "array",
          items: {type: "string"}
        }
      ],
      nullable: true,
    }
  },
  required: ["type"]
}

// @ts-expect-error Va donc comprendre
const schémaÉpingleMotClef: JSONSchemaType<ÉpingleMotClef> =  {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "motClef"
    },
    base: schémaTypeDispositif
  },
  required: ["type"]
}
// @ts-expect-error Va donc comprendre
const schémaÉpingleBd: JSONSchemaType<ÉpingleBd> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "bd"
    },
    base: schémaTypeDispositif,
    fichiersBase: schémaTypeDispositif,
    données: {
      type: "object",
      properties: {
        fichiers: schémaTypeDispositif,
        tableaux: schémaTypeDispositif
      },
      nullable: true,
    },
  },
  required: ["type"]
}
// @ts-expect-error Va donc comprendre
const schémaÉpingleNuée: JSONSchemaType<ÉpingleNuée> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "nuée"
    },
    base: schémaTypeDispositif,
    fichiersBase: schémaTypeDispositif,
    données: schémaÉpingleBd,
  }
}
// @ts-expect-error Va donc comprendre
const schémaÉpingleProjet: JSONSchemaType<ÉpingleProjet> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "projet"
    },
    base: schémaTypeDispositif,
    fichiersBase: schémaTypeDispositif,
    bds: schémaÉpingleBd,
  },
  required: []
}

// @ts-expect-error Va donc comprendre
const schémaÉpingleProfil: JSONSchemaType<ÉpingleProfil> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "profil"
    },
    base: schémaTypeDispositif,
    fichiers: schémaTypeDispositif,
  },
}
// @ts-expect-error Va donc comprendre
const schémaÉpingleCompte: JSONSchemaType<ÉpingleCompte> = {
  type: "object",
  properties: {
    type: {
      type: "string",
      const: "compte"
    },
    base: schémaTypeDispositif,
    profil: schémaÉpingleProfil,
    favoris: schémaTypeDispositif,
  },
}

const schémaÉpingleFavoris: JSONSchemaType<ÉpingleFavoris> = {
  anyOf: [
    schémaÉpingleVariable,
    schémaÉpingleMotClef,
    schémaÉpingleBd,
    schémaÉpingleNuée,
    schémaÉpingleProjet,
    schémaÉpingleCompte,
    schémaÉpingleProfil,
  ]
};

type structureBdFavoris = { [idObjet: string]: ÉpingleFavoris };
const schémaBdPrincipale: JSONSchemaType<structureBdFavoris> = {
  type: "object",
  additionalProperties: schémaÉpingleFavoris,
  required: [],
};

export class Favoris extends ComposanteClientDic<structureBdFavoris> {
  _promesseInit: Promise<void>;
  oublierÉpingler?: schémaFonctionOublier;

  constructor({ client }: { client: Constellation }) {
    super({ client, clef: "favoris", schémaBdPrincipale });

    this._promesseInit = this._épinglerFavoris();
  }

  async suivreRésolutionÉpingle({épingle, f}: {épingle: ÉpingleFavorisAvecId; f: schémaFonctionSuivi<Set<string>>}) {
    switch (épingle.épingle.type) {
      case "motClef":
        return await this.client.motsClefs.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleMotClef>,
          f,
        });
      case "variable":
        return await this.client.variables.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleVariable>,
          f,
        });
      case "bd":
        return await this.client.bds.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleBd>,
          f,
        });
      case "projet":
        return await this.client.projets.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleProjet>,
          f,
        });
      case "nuée":
        return await this.client.nuées.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleNuée>,
          f,
        });
      case "compte":
        return await this.client.suivreRésolutionÉpingle({
          épingle: épingle as ÉpingleFavorisAvecId<ÉpingleCompte>,
          f,
        });

      default:
        throw new Error(String(épingle));
    }
  }

  async _épinglerFavoris() {
    const fFinale = async (
      résolutions: { idObjet: string; épingles: string[] }[],
    ) => {
      return await this.client.épingles.épingler({
        idRequête: "favoris",
        épingles: new Set(résolutions.map((r) => r.épingles).flat()),
      });
    };

    const fListe = async (
      fSuivreRacine: (éléments: ÉpingleFavorisAvecId[]) => Promise<void>,
    ) => {
      return await this.suivreBdPrincipale({
        f: (x) =>
          fSuivreRacine(
            Object.entries(x).map(([idObjet, épingle]) => ({
              idObjet,
              épingle,
            })),
          ),
      });
    };
    const fBranche = async (
      _id: string,
      fSuivreBranche: schémaFonctionSuivi<Set<string>>,
      branche: ÉpingleFavorisAvecId<ÉpingleFavoris>,
    ) => {
      return await this.suivreRésolutionÉpingle({épingle: branche, f: fSuivreBranche});
    };
    const fIdBdDeBranche = (b: ÉpingleFavorisAvecId) => b.idObjet;
    const fCode = (b: ÉpingleFavorisAvecId) => b.idObjet;

    const fOublier = await suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fIdBdDeBranche,
      fCode,
    });

    this.oublierÉpingler = fOublier;
  }

  @cacheSuivi
  async suivreFavoris({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<ÉpingleFavorisAvecId[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (favoris: { [key: string]: ÉpingleFavoris }) => {
      const favorisFinaux = Object.entries(favoris).map(
        ([idObjet, épingle]) => {
          return {
            idObjet,
            épingle,
          };
        },
      );
      await f(favorisFinaux);
    };

    return await this.suivreBdPrincipale({
      idCompte,
      f: fFinale,
    });
  }

  async épinglerFavori({
    idObjet,
    épingle,
  }: {
    idObjet: string;
    épingle: ÉpingleFavoris;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();

    const élément = effacerPropriétésNonDéfinies(épingle);
    const existant = bd.get(idObjet);
    if (!deepEqual(existant, élément))  // À faire : déménager à Bohr-DB
      await bd.put(idObjet, élément);

    await fOublier();
  }

  async désépinglerFavori({ idObjet }: { idObjet: string }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.del(idObjet);
    await fOublier();
  }

  @cacheSuivi
  async suivreÉtatFavori({
    idObjet,
    f,
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<ÉpingleFavoris | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: (favoris) => f(favoris[idObjet]),
    });
  }

  @cacheSuivi
  async suivreEstÉpingléSurDispositif({
    idObjet,
    f
  }: {
    idObjet: string;
    f: schémaFonctionSuivi<BooléenniserPropriétés<ÉpingleFavoris> | undefined>;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      f: async (favoris) => f(await this.résoudreÉpinglesSurDispositif({épingle: favoris[idObjet]})),
    });
  }

  async résoudreÉpinglesSurDispositif<T extends ÉpingleFavoris>({épingle, idDispositif}: {épingle: T, idDispositif?: string}): Promise<BooléenniserPropriétés<T>> {
    return Object.fromEntries(
      await Promise.all(Object.entries(épingle).map(async ([clef, val])=>{
        if (clef === 'type') return [clef, val];
        else if (Array.isArray(clef) || typeof clef === 'string') {
          return [clef, await this.estÉpingléSurDispositif({dispositifs: val,idDispositif})]
        } else {
          return [clef, await this.estÉpingléSurDispositif({dispositifs: val,  idDispositif})]
        }
      }))
    )  as BooléenniserPropriétés<T>
  }

  async estÉpingléSurDispositif({
    dispositifs,
    idDispositif,
  }: {
    dispositifs: typeDispositifs;
    idDispositif?: string;
  }): Promise<boolean> {
    const ceDispositif = await this.client.obtIdDispositif();

    idDispositif = idDispositif || ceDispositif;

    if (dispositifs === "AUCUN") {
      return false;
    } else if (dispositifs === "TOUS") {
      return true;
    } else if (dispositifs === "INSTALLÉ") {
      if (idDispositif === ceDispositif) {
        return isNode || isElectronMain;
      } else {
        return false; // En réalité, inconnu. Mais on ne peut pas magiquement deviner la plateforme d'un autre paire.
      }
    } else if (typeof dispositifs === "string") {
      return dispositifs === idDispositif;
    } else {
      return dispositifs.includes(idDispositif);
    }
  }

  async fermer(): Promise<void> {
    await this._promesseInit;
    if (this.oublierÉpingler) await this.oublierÉpingler();
  }
}
