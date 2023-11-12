import { v4 as uuidv4 } from "uuid";

import type ClientConstellation from "@/client.js";
import type générerContrôleurConstellation from "@/accès/cntrlConstellation.js";
import {
  type règleVariable,
  type règleCatégorie,
  règleVariableAvecId,
} from "@/valid.js";

import type { objRôles } from "@/accès/types.js";
import type { dicTrads } from "@/types.js";
import { cacheSuivi } from "@/décorateursCache.js";

import {
  TYPES_STATUT,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  schémaStatut,
  schémaStructureBdNoms,
} from "@/types.js";
import { ComposanteClientListe } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";
import { estUnContrôleurConstellation } from "./accès/utils.js";

type ContrôleurConstellation = Awaited<
  ReturnType<ReturnType<typeof générerContrôleurConstellation>>
>;

export type catégorieBaseVariables =
  | "numérique"
  | "horoDatage"
  | "intervaleTemps"
  | "chaîne"
  | "chaîneNonTraductible"
  | "booléen"
  | "géojson"
  | "vidéo"
  | "audio"
  | "image"
  | "fichier";

export type catégorieVariables =
  | {
      type: "simple";
      catégorie: catégorieBaseVariables;
    }
  | {
      type: "liste";
      catégorie: catégorieBaseVariables;
    };

const schémaBdPrincipale: JSONSchemaType<string> = {
  type: "string",
};

export type structureBdVariable = {
  type: string;
  catégorie: Partial<catégorieVariables>;
  noms: string;
  unités?: string;
  descriptions: string;
  règles: string;
  statut: Partial<schémaStatut>;
};

const schémaStructureBdVariable: JSONSchemaType<Partial<structureBdVariable>> =
  {
    type: "object",
    properties: {
      type: { type: "string", nullable: true },
      catégorie: {
        type: "object",
        properties: {
          catégorie: { type: "string", nullable: true },
          type: { type: "string", nullable: true },
        },
        required: [],
        nullable: true,
      },
      noms: { type: "string", nullable: true },
      descriptions: { type: "string", nullable: true },
      unités: { type: "string", nullable: true },
      règles: { type: "string", nullable: true },
      statut: {
        type: "object",
        properties: {
          idNouvelle: { type: "string", nullable: true },
          statut: { type: "string", nullable: true },
        },
        required: [],
        nullable: true,
      },
    },
    required: [],
  };

export type structureBdRèglesVariable = { [idRègle: string]: règleVariable };
export const schémaBdRèglesVariable: JSONSchemaType<structureBdRèglesVariable> =
  {
    type: "object",
    additionalProperties: {
      type: "object",
      properties: {
        typeRègle: { type: "string" },
        détails: {
          type: "object",
          required: [],
          additionalProperties: true,
        },
      },
      required: ["détails", "typeRègle"],
    },
    required: [],
  };

export default class Variables extends ComposanteClientListe<string> {
  constructor({ client }: { client: ClientConstellation }) {
    super({ client, clef: "variables", schémaBdPrincipale });
  }

  async épingler() {
    await this.client.épingles.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  @cacheSuivi
  async suivreVariables({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({ idCompte, f });
  }

  async créerVariable({
    catégorie,
  }: {
    catégorie: catégorieVariables | catégorieBaseVariables;
  }): Promise<string> {
    const idBdVariable = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès: {
        address: undefined,
        write: await this.client.obtIdCompte(),
      },
    });
    await this.ajouterÀMesVariables({ idVariable: idBdVariable });

    const { bd: bdVariable, fOublier: fOublierVariable } =
      await this.client.ouvrirBdTypée({
        id: idBdVariable,
        type: "keyvalue",
        schéma: schémaStructureBdVariable,
      });

    const accès = bdVariable.access as ContrôleurConstellation;
    if (!estUnContrôleurConstellation(accès))
      throw Error("Contrôleur de type non reconnu.");
    const optionsAccès = { address: accès.address };

    await bdVariable.set("type", "variable");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdVariable.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdVariable.set("descriptions", idBdDescr);

    const idBdRègles = await this.client.créerBdIndépendante({
      type: "keyvalue",
      optionsAccès,
    });
    await bdVariable.set("règles", idBdRègles);

    await bdVariable.set(
      "catégorie",
      this.standardiserCatégorieVariable(catégorie),
    );

    await this.établirStatut({
      id: idBdVariable,
      statut: { statut: TYPES_STATUT.ACTIVE },
    });

    fOublierVariable();

    return idBdVariable;
  }

  async ajouterÀMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.obtBd();
    await bd.add(idVariable);
    await fOublier();
  }

  async enleverDeMesVariables({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.obtBd();
    await bdRacine.del(idVariable);
    await fOublier();
  }

  async copierVariable({
    idVariable,
  }: {
    idVariable: string;
  }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } =
      await this.client.ouvrirBdTypée({
        id: idVariable,
        type: "keyvalue",
        schéma: schémaStructureBdVariable,
      });
    const catégorie = (await bdBase.get("catégorie")) as
      | catégorieVariables
      | catégorieBaseVariables;

    const idNouvelleBd = await this.créerVariable({ catégorie });
    const { bd: bdNouvelle, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBdTypée({
        id: idNouvelleBd,
        type: "keyvalue",
        schéma: schémaStructureBdVariable,
      });

    const idBdNoms = await bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierBdNoms } =
        await this.client.ouvrirBdTypée({
          id: idBdNoms,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const noms = await bdNoms.allAsJSON();
      await fOublierBdNoms();
      await this.sauvegarderNomsVariable({ idVariable: idNouvelleBd, noms });
    }

    const idBdDescr = await bdBase.get("descriptions");
    if (idBdDescr) {
      const { bd: bdDescr, fOublier: fOublierBdDescr } =
        await this.client.ouvrirBdTypée({
          id: idBdDescr,
          type: "keyvalue",
          schéma: schémaStructureBdNoms,
        });
      const descriptions = await bdDescr.allAsJSON();
      await fOublierBdDescr();
      await this.sauvegarderDescriptionsVariable({
        idVariable: idNouvelleBd,
        descriptions,
      });
    }

    const unités = await bdBase.get("unités");
    if (unités) await bdNouvelle.put("unités", unités);

    const idBdRègles = await bdBase.get("règles");
    if (idBdRègles) {
      const { bd: bdRègles, fOublier: fOublierBdRègles } =
        await this.client.ouvrirBdTypée({
          id: idBdRègles,
          type: "keyvalue",
          schéma: schémaBdRèglesVariable,
        });
      const règles = await bdRègles.allAsJSON();
      await fOublierBdRègles();
      await Promise.all(
        Object.entries(règles).map(async ([id, r]) => {
          await this.ajouterRègleVariable({
            idVariable: idNouvelleBd,
            règle: r,
            idRègle: id,
          });
        }),
      );
    }

    const statut = ((await bdBase.get("statut")) as schémaStatut) || {
      statut: TYPES_STATUT.ACTIVE,
    };
    await this.établirStatut({ id: idNouvelleBd, statut });

    await Promise.all([fOublierBase(), fOublierNouvelle()]);

    return idNouvelleBd;
  }

  async inviterAuteur({
    idVariable,
    idCompteAuteur,
    rôle,
  }: {
    idVariable: string;
    idCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idVariable,
      identité: idCompteAuteur,
      rôle,
    });
  }

  async sauvegarderNomsVariable({
    idVariable,
    noms,
  }: {
    idVariable: string;
    noms: dicTrads;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdNoms)
      throw new Error(
        `Permission de modification refusée pour Variable ${idVariable}.`,
      );

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomVariable({
    idVariable,
    langue,
    nom,
  }: {
    idVariable: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdNoms)
      throw new Error(
        `Permission de modification refusée pour variable ${idVariable}.`,
      );

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomVariable({
    idVariable,
    langue,
  }: {
    idVariable: string;
    langue: string;
  }): Promise<void> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdNoms)
      throw new Error(
        `Permission de modification refusée pour Variable ${idVariable}.`,
      );

    const { bd: bdNoms, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdNoms.del(langue);
    await fOublier();
  }

  async sauvegarderDescriptionsVariable({
    idVariable,
    descriptions,
  }: {
    idVariable: string;
    descriptions: dicTrads;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdDescr)
      throw new Error(
        `Permission de modification refusée pour Variable ${idVariable}.`,
      );

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescriptionVariable({
    idVariable,
    langue,
    description,
  }: {
    idVariable: string;
    langue: string;
    description: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdDescr)
      throw new Error(
        `Permission de modification refusée pour Variable ${idVariable}.`,
      );

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdDescr.set(langue, description);

    await fOublier();
  }

  async effacerDescriptionVariable({
    idVariable,
    langue,
  }: {
    idVariable: string;
    langue: string;
  }): Promise<void> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdDescr)
      throw new Error(
        `Permission de modification refusée pour Variable ${idVariable}.`,
      );

    const { bd: bdDescr, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
    await bdDescr.del(langue);

    await fOublier();
  }

  async sauvegarderCatégorieVariable({
    idVariable,
    catégorie,
  }: {
    idVariable: string;
    catégorie: catégorieVariables | catégorieBaseVariables;
  }): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "keyvalue",
      schéma: schémaStructureBdVariable,
    });
    await bdVariable.set(
      "catégorie",
      this.standardiserCatégorieVariable(catégorie),
    );

    await fOublier();
  }

  standardiserCatégorieVariable(
    catégorie: catégorieBaseVariables | catégorieVariables,
  ): catégorieVariables {
    return typeof catégorie === "string"
      ? { type: "simple", catégorie }
      : catégorie;
  }

  async sauvegarderUnitésVariable({
    idVariable,
    idUnité,
  }: {
    idVariable: string;
    idUnité: string;
  }): Promise<void> {
    const { bd: bdVariable, fOublier } = await this.client.ouvrirBdTypée({
      id: idVariable,
      type: "keyvalue",
      schéma: schémaStructureBdVariable,
    });
    await bdVariable.set("unités", idUnité);

    await fOublier();
  }

  async ajouterRègleVariable({
    idVariable,
    règle,
    idRègle,
  }: {
    idVariable: string;
    règle: règleVariable;
    idRègle?: string;
  }): Promise<string> {
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdRègles) {
      throw new Error(
        `Permission de modification refusée pour variable ${idVariable}.`,
      );
    }

    idRègle = idRègle || uuidv4();

    const { bd: bdRègles, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdRègles,
      type: "keyvalue",
      schéma: schémaBdRèglesVariable,
    });
    await bdRègles.put(idRègle, règle);

    await fOublier();

    return idRègle;
  }

  async effacerRègleVariable({
    idVariable,
    idRègle,
  }: {
    idVariable: string;
    idRègle: string;
  }): Promise<void> {
    const idBdRègles = await this.client.obtIdBd({
      nom: "règles",
      racine: idVariable,
      type: "keyvalue",
    });
    if (!idBdRègles) {
      throw new Error(
        `Permission de modification refusée pour variable ${idVariable}.`,
      );
    }
    const { bd: bdRègles, fOublier } = await this.client.ouvrirBdTypée({
      id: idBdRègles,
      type: "keyvalue",
      schéma: schémaBdRèglesVariable,
    });

    await bdRègles.del(idRègle);

    await fOublier();
  }

  async modifierRègleVariable({
    idVariable,
    règleModifiée,
    idRègle,
  }: {
    idVariable: string;
    règleModifiée: règleVariable;
    idRègle: string;
  }): Promise<void> {
    await this.effacerRègleVariable({ idVariable, idRègle });
    await this.ajouterRègleVariable({
      idVariable,
      règle: règleModifiée,
      idRègle,
    });
  }

  @cacheSuivi
  async suivreNomsVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idVariable,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreDescriptionsVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id: idVariable,
      clef: "descriptions",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreCatégorieVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<catégorieVariables>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idVariable,
      type: "keyvalue",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        const catégorie = await bd.get("catégorie");
        if (catégorie && catégorie.catégorie && catégorie.type)
          await f(
            this.standardiserCatégorieVariable(catégorie as catégorieVariables),
          );
      },
    });
  }

  @cacheSuivi
  async suivreUnitésVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<string | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idVariable,
      type: "keyvalue",
      schéma: schémaStructureBdVariable,
      f: async (bd) => {
        const unités = await bd.get("unités");
        await f(unités || null);
      },
    });
  }

  @cacheSuivi
  async suivreRèglesVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<règleVariableAvecId[]>;
  }): Promise<schémaFonctionOublier> {
    const règles: {
      catégorie: { [id: string]: règleVariable };
      propres: { [id: string]: règleVariable };
    } = {
      catégorie: {},
      propres: {},
    };
    const fFinale = async () => {
      await f(
        Object.entries(Object.assign({}, règles.catégorie, règles.propres)).map(
          ([id, r]) => ({ id, règle: r }),
        ),
      );
    };

    const fSuivreCatégorie = async (catégorie: catégorieVariables) => {
      const règleCat: { [id: string]: règleCatégorie } = {
        [uuidv4()]: {
          typeRègle: "catégorie",
          détails: { catégorie },
        },
      };
      règles.catégorie = règleCat;
      await fFinale();
    };
    const fOublierCatégorie = await this.suivreCatégorieVariable({
      idVariable,
      f: fSuivreCatégorie,
    });

    const fSuivreRèglesPropres = async (rgls: {
      [id: string]: règleVariable;
    }) => {
      règles.propres = rgls;
      await fFinale();
    };
    const fOublierRèglesPropres = await this.client.suivreBdDicDeClef({
      id: idVariable,
      clef: "règles",
      schéma: schémaBdRèglesVariable,
      f: fSuivreRèglesPropres,
    });

    const fOublier = async () => {
      await fOublierCatégorie();
      await fOublierRèglesPropres();
    };
    return fOublier;
  }

  @cacheSuivi
  async suivreQualitéVariable({
    idVariable,
    f,
  }: {
    idVariable: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    const rés: {
      noms: { [key: string]: string };
      descr: { [key: string]: string };
      règles: règleVariableAvecId<règleVariable>[];
      unités?: string | null;
      catégorie?: catégorieVariables;
    } = {
      noms: {},
      descr: {},
      règles: [],
    };
    const fFinale = async () => {
      const scores = [
        Object.keys(rés.noms).length ? 1 : 0,
        Object.keys(rés.descr).length ? 1 : 0,
      ];
      if (rés.catégorie?.catégorie === "numérique") {
        scores.push(rés.unités ? 1 : 0);
      }
      if (rés.catégorie?.catégorie === "numérique") {
        scores.push(rés.règles.length >= 1 ? 1 : 0);
      }
      const qualité = scores.reduce((a, b) => a + b, 0) / scores.length;
      await f(qualité);
    };
    const oublierNoms = await this.suivreNomsVariable({
      idVariable,
      f: async (noms) => {
        rés.noms = noms;
        await fFinale();
      },
    });

    const oublierDescr = await this.suivreDescriptionsVariable({
      idVariable,
      f: async (descr) => {
        rés.descr = descr;
        await fFinale();
      },
    });

    const oublierUnités = await this.suivreUnitésVariable({
      idVariable,
      f: async (unités) => {
        rés.unités = unités;
        await fFinale();
      },
    });

    const oublierCatégorie = await this.suivreCatégorieVariable({
      idVariable,
      f: async (catégorie) => {
        rés.catégorie = catégorie;
        await fFinale();
      },
    });

    const oublierRègles = await this.suivreRèglesVariable({
      idVariable,
      f: async (règles) => {
        rés.règles = règles;
        await fFinale();
      },
    });

    const fOublier = async () => {
      await Promise.all([
        oublierNoms(),
        oublierDescr(),
        oublierUnités(),
        oublierCatégorie(),
        oublierRègles(),
      ]);
    };

    return fOublier;
  }

  async établirStatut({
    id,
    statut,
  }: {
    id: string;
    statut: schémaStatut;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdVariable,
    });
    await bd.set("statut", statut);
    await fOublier();
  }

  async marquerObsolète({
    id,
    idNouvelle,
  }: {
    id: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBdTypée({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdVariable,
    });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    await fOublier();
  }

  async effacerVariable({ idVariable }: { idVariable: string }): Promise<void> {
    // Effacer l'entrée dans notre liste de variables
    await this.enleverDeMesVariables({ idVariable });

    // Effacer la variable elle-même
    for (const clef in ["noms", "descriptions", "règles"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: idVariable,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }
    await this.client.effacerBd({ id: idVariable });
  }
}
