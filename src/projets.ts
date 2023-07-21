import type KeyValueStore from "orbit-db-kvstore";
import type FeedStore from "orbit-db-feedstore";
import type { ImportCandidate } from "ipfs-core-types/src/utils";

import { WorkBook, BookType, write as writeXLSX } from "xlsx";
import toBuffer from "it-to-buffer";
import path from "path";

import ClientConstellation from "@/client.js";
import type { objRôles } from "@/accès/types.js";
import type { default as ContrôleurConstellation } from "@/accès/cntrlConstellation.js";
import { cacheSuivi } from "@/décorateursCache.js";
import {
  traduire,
  zipper,
  TYPES_STATUT,
  schémaStatut,
  schémaFonctionSuivi,
  schémaFonctionOublier,
  uneFois,
  schémaStructureBdNoms,
  structureBdNoms,
} from "@/utils/index.js";
import { ComposanteClientListe } from "./composanteClient.js";
import { JSONSchemaType } from "ajv";
import { schémaCopiéDe } from "./bds.js";

export interface donnéesProjetExportées {
  docs: { doc: WorkBook; nom: string }[];
  fichiersSFIP: Set<{ cid: string; ext: string }>;
  nomFichier: string;
}

export type typeÉlémentsBdProjet = string | schémaStatut;

export const MAX_TAILLE_IMAGE = 500 * 1000; // 500 kilooctets
export const MAX_TAILLE_IMAGE_VIS = 1500 * 1000; // 1,5 megaoctets

const schémaBdPrincipale: JSONSchemaType<string> = { type: "string" };

export type structureBdProjet = {
  type: "projet";
  noms: string;
  descriptions: string;
  image?: string;
  bds: string;
  motsClefs: string;
  statut: schémaStatut;
  copiéDe: schémaCopiéDe;
};
const schémaStructureBdProjet: JSONSchemaType<structureBdProjet> = {
  type: "object",
  properties: {
    type: { type: "string" },
    noms: { type: "string" },
    descriptions: { type: "string" },
    bds: { type: "string" },
    image: { type: "string", nullable: true },
    motsClefs: { type: "string" },
    statut: {
      type: "object",
      properties: {
        statut: { type: "string" },
        idNouvelle: { type: "string", nullable: true },
      },
      required: ["statut"],
    },
    copiéDe: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  required: ["noms", "descriptions", "statut", "type", "bds", "copiéDe"],
};

export default class Projets extends ComposanteClientListe<string> {
  constructor({ client }: { client: ClientConstellation }) {
    super({ client, clef: "projets", schémaBdPrincipale: schémaBdPrincipale });
  }

  async épingler() {
    await this.client.épingles?.épinglerBd({
      id: await this.obtIdBd(),
      récursif: false,
      fichiers: false,
    });
  }

  @cacheSuivi
  async suivreProjets({
    f,
    idCompte,
  }: {
    f: schémaFonctionSuivi<string[]>;
    idCompte?: string;
  }): Promise<schémaFonctionOublier> {
    return await this.suivreBdPrincipale({
      idCompte,
      f,
    });
  }

  async créerProjet(): Promise<string> {
    const { bd: bdRacine, fOublier: fOublierRacine } =
      await this.client.ouvrirBd<FeedStore<string>>({
        id: await this.obtIdBd(),
      });
    const idBdProjet = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès: {
        address: undefined,
        premierMod: this.client.bdCompte!.id,
      },
    });

    const { bd: bdProjet, fOublier: fOublierProjet } =
      await this.client.ouvrirBd({
        id: idBdProjet,
        type: "keyvalue",
        schéma: schémaStructureBdProjet,
      });

    const accès = bdProjet.access as unknown as ContrôleurConstellation;
    const optionsAccès = { address: accès.address };

    await bdProjet.set("type", "projet");

    const idBdNoms = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdProjet.set("noms", idBdNoms);

    const idBdDescr = await this.client.créerBdIndépendante({
      type: "kvstore",
      optionsAccès,
    });
    await bdProjet.set("descriptions", idBdDescr);

    const idBdBds = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdProjet.set("bds", idBdBds);

    const idBdMotsClefs = await this.client.créerBdIndépendante({
      type: "feed",
      optionsAccès,
    });
    await bdProjet.set("motsClefs", idBdMotsClefs);

    await bdProjet.set("statut", { statut: TYPES_STATUT.ACTIVE });

    await bdRacine.add(idBdProjet);

    fOublierRacine();
    fOublierProjet();

    return idBdProjet;
  }

  async copierProjet({ id }: { id: string }): Promise<string> {
    const { bd: bdBase, fOublier: fOublierBase } = await this.client.ouvrirBd({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    const idNouveauProjet = await this.créerProjet();
    const { bd: nouvelleBd, fOublier: fOublierNouvelle } =
      await this.client.ouvrirBd({
        id: idNouveauProjet,
        type: "keyvalue",
        schéma: schémaStructureBdProjet,
      });

    const idBdNoms = bdBase.get("noms");
    if (idBdNoms) {
      const { bd: bdNoms, fOublier: fOublierNoms } = await this.client.ouvrirBd({
        id: idBdNoms,
        type: "keyvalue",
        schéma: schémaStructureBdNoms,
      });
      const noms = ClientConstellation.obtObjetdeBdDic({ bd: bdNoms }) as {
        [key: string]: string;
      };
      await fOublierNoms();
      await this.ajouterNomsProjet({ id: idNouveauProjet, noms });
    }

    const idBdDescr = bdBase.get("descriptions");
    if (idBdDescr) {
      const { bd: bdDescr, fOublier: fOublierDescr } = await this.client.ouvrirBd(
        { id: idBdDescr, type: "keyvalue", schéma: schémaStructureBdNoms }
      );
      const descriptions = ClientConstellation.obtObjetdeBdDic({
        bd: bdDescr,
      }) as {
        [key: string]: string;
      };
      await fOublierDescr();
      await this.ajouterDescriptionsProjet({ id: idNouveauProjet, descriptions });
    }

    const idBdMotsClefs = bdBase.get("motsClefs");
    if (idBdMotsClefs) {
      const { bd: bdMotsClefs, fOublier: fOublierMotsClefs } =
      await this.client.ouvrirBd<FeedStore<string>>({ id: idBdMotsClefs });
      const idsMotsClefs = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdMotsClefs,
      });
      await fOublierMotsClefs();
      await this.ajouterMotsClefsProjet({
        idProjet: idNouveauProjet,
        idsMotsClefs,
      });
    }

    const idBdBds = bdBase.get("bds");
    if (idBdBds) {
      const { bd: bdBds, fOublier: fOublierBds } = await this.client.ouvrirBd<
        FeedStore<string>
      >({ id: idBdBds });
      const bds = ClientConstellation.obtÉlémentsDeBdListe({
        bd: bdBds,
      });
      await fOublierBds();
      await Promise.all(
        bds.map(async (idBd: string) => {
          await this.ajouterBdProjet({ idProjet: idNouveauProjet, idBd });
        })
      );
    }

    const statut = bdBase.get("statut") || { statut: TYPES_STATUT.ACTIVE };
    await nouvelleBd.set("statut", statut);

    const image = bdBase.get("image");
    if (image) await nouvelleBd.set("image", image);

    await nouvelleBd.set("copiéDe", { id });

    await Promise.all([fOublierBase(), fOublierNouvelle()]);
    return idNouveauProjet;
  }

  async ajouterÀMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: await this.obtIdBd() });
    await bdRacine.add(idProjet);
    await fOublier();
  }

  async enleverDeMesProjets({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd: bdRacine, fOublier } = await this.client.ouvrirBd<
      FeedStore<string>
    >({ id: await this.obtIdBd() });
    await this.client.effacerÉlémentDeBdListe({
      bd: bdRacine,
      élément: idProjet,
    });
    await fOublier();
  }

  async inviterAuteur({
    idProjet,
    idBdCompteAuteur,
    rôle,
  }: {
    idProjet: string;
    idBdCompteAuteur: string;
    rôle: keyof objRôles;
  }): Promise<void> {
    await this.client.donnerAccès({
      idBd: idProjet,
      identité: idBdCompteAuteur,
      rôle,
    });
  }

  async _obtBdNoms({ id }: { id: string }): Promise<{
    bd: KeyValueStore<structureBdNoms>;
    fOublier: schémaFonctionOublier;
  }> {
    const idBdNoms = await this.client.obtIdBd({
      nom: "noms",
      racine: id,
      type: "kvstore",
    });
    if (!idBdNoms) {
      throw new Error(`Permission de modification refusée pour Projet ${id}.`);
    }

    return await this.client.ouvrirBd({
      id: idBdNoms,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
  }

  async ajouterNomsProjet({
    id,
    noms,
  }: {
    id: string;
    noms: { [key: string]: string };
  }): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms({ id });
    for (const lng in noms) {
      await bdNoms.set(lng, noms[lng]);
    }
    await fOublier();
  }

  async sauvegarderNomProjet({
    id,
    langue,
    nom,
  }: {
    id: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms({ id });
    await bdNoms.set(langue, nom);
    await fOublier();
  }

  async effacerNomProjet({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const { bd: bdNoms, fOublier } = await this._obtBdNoms({ id });
    await bdNoms.del(langue);
    await fOublier();
  }

  async _obtBdDescr({ id }: { id: string }): Promise<{
    bd: KeyValueStore<structureBdNoms>;
    fOublier: schémaFonctionOublier;
  }> {
    const idBdDescr = await this.client.obtIdBd({
      nom: "descriptions",
      racine: id,
      type: "kvstore",
    });
    if (!idBdDescr) {
      throw new Error(`Permission de modification refusée pour Projet ${id}.`);
    }

    return await this.client.ouvrirBd({
      id: idBdDescr,
      type: "keyvalue",
      schéma: schémaStructureBdNoms,
    });
  }

  async ajouterDescriptionsProjet({
    id,
    descriptions,
  }: {
    id: string;
    descriptions: { [key: string]: string };
  }): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr({ id });
    for (const lng in descriptions) {
      await bdDescr.set(lng, descriptions[lng]);
    }
    await fOublier();
  }

  async sauvegarderDescrProjet({
    id,
    langue,
    nom,
  }: {
    id: string;
    langue: string;
    nom: string;
  }): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr({ id });
    await bdDescr.set(langue, nom);
    await fOublier();
  }

  async effacerDescrProjet({
    id,
    langue,
  }: {
    id: string;
    langue: string;
  }): Promise<void> {
    const { bd: bdDescr, fOublier } = await this._obtBdDescr({ id });
    await bdDescr.del(langue);
    await fOublier();
  }

  async _obtBdMotsClefs({
    id,
  }: {
    id: string;
  }): Promise<{ bd: FeedStore<string>; fOublier: schémaFonctionOublier }> {
    const idBdMotsClefs = await this.client.obtIdBd({
      nom: "motsClefs",
      racine: id,
      type: "feed",
    });
    if (!idBdMotsClefs) {
      throw new Error(`Permission de modification refusée pour projet ${id}.`);
    }

    return await this.client.ouvrirBd<FeedStore<string>>({ id: idBdMotsClefs });
  }

  async ajouterMotsClefsProjet({
    idProjet,
    idsMotsClefs,
  }: {
    idProjet: string;
    idsMotsClefs: string | string[];
  }): Promise<void> {
    if (!Array.isArray(idsMotsClefs)) idsMotsClefs = [idsMotsClefs];
    const { bd: bdMotsClefs, fOublier } = await this._obtBdMotsClefs({
      id: idProjet,
    });

    await Promise.all(
      idsMotsClefs.map(async (id: string) => {
        const motsClefsExistants =
          ClientConstellation.obtÉlémentsDeBdListe<string>({ bd: bdMotsClefs });
        if (!motsClefsExistants.includes(id)) await bdMotsClefs.add(id);
      })
    );
    await fOublier();
  }

  async effacerMotClefProjet({
    idProjet,
    idMotClef,
  }: {
    idProjet: string;
    idMotClef: string;
  }): Promise<void> {
    const { bd: bdMotsClefs, fOublier } = await this._obtBdMotsClefs({
      id: idProjet,
    });
    await this.client.effacerÉlémentDeBdListe({
      bd: bdMotsClefs,
      élément: idMotClef,
    });
    await fOublier();
  }

  async _obtBdBds({
    id,
  }: {
    id: string;
  }): Promise<{ bd: FeedStore<string>; fOublier: schémaFonctionOublier }> {
    const idBdBds = await this.client.obtIdBd({
      nom: "bds",
      racine: id,
      type: "feed",
    });
    if (!idBdBds)
      throw new Error(`Permission de modification refusée pour Projet ${id}.`);

    return await this.client.ouvrirBd<FeedStore<string>>({ id: idBdBds });
  }

  async ajouterBdProjet({
    idProjet,
    idBd,
  }: {
    idProjet: string;
    idBd: string;
  }): Promise<void> {
    const { bd: bdBds, fOublier } = await this._obtBdBds({ id: idProjet });
    await bdBds.add(idBd);
    await fOublier();
  }

  async effacerBdProjet({
    idProjet,
    idBd,
  }: {
    idProjet: string;
    idBd: string;
  }): Promise<void> {
    const { bd: bdBds, fOublier } = await this._obtBdBds({ id: idProjet });

    // Effacer l'entrée dans notre liste de bds (n'efface pas la BD elle-même)
    await this.client.effacerÉlémentDeBdListe({ bd: bdBds, élément: idBd });
    await fOublier();
  }

  async marquerObsolète({
    id,
    idNouvelle,
  }: {
    id: string;
    idNouvelle?: string;
  }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.OBSOLÈTE, idNouvelle });
    await fOublier();
  }

  async marquerActive({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.ACTIVE });
    await fOublier();
  }

  async marquerBêta({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.BÊTA });
    await fOublier();
  }

  async marquerInterne({ id }: { id: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd({
      id,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    bd.set("statut", { statut: TYPES_STATUT.INTERNE });
    await fOublier();
  }

  async sauvegarderImage({
    idProjet,
    image,
  }: {
    idProjet: string;
    image: ImportCandidate;
  }): Promise<void> {
    let contenu: ImportCandidate;

    if ((image as File).size !== undefined) {
      if ((image as File).size > MAX_TAILLE_IMAGE) {
        throw new Error("Taille maximale excédée");
      }
      contenu = await (image as File).arrayBuffer();
    } else {
      contenu = image;
    }
    const idImage = await this.client.ajouterÀSFIP({ fichier: contenu });
    const { bd, fOublier } = await this.client.ouvrirBd({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    await bd.set("image", idImage);
    await fOublier();
  }

  async effacerImage({ idProjet }: { idProjet: string }): Promise<void> {
    const { bd, fOublier } = await this.client.ouvrirBd({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
    });
    await bd.del("image");
    await fOublier();
  }

  @cacheSuivi
  async suivreImage({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<Uint8Array | null>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBd({
      id: idProjet,
      type: "keyvalue",
      schéma: schémaStructureBdProjet,
      f: async (bd) => {
        const idImage = bd.get("image");
        if (!idImage) {
          await f(null);
        } else {
          const image = await this.client.obtFichierSFIP({
            id: idImage,
            max: MAX_TAILLE_IMAGE_VIS,
          });
          await f(image);
        }
      },
    });
  }

  @cacheSuivi
  async suivreNomsProjet({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id,
      clef: "noms",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreDescrProjet({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<{ [key: string]: string }>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdDicDeClef({
      id,
      clef: "descriptions",
      schéma: schémaStructureBdNoms,
      f,
    });
  }

  @cacheSuivi
  async suivreMotsClefsProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const motsClefs: { propres?: string[]; bds?: string[] } = {};
    const fFinale = async () => {
      if (motsClefs.propres && motsClefs.bds) {
        const motsClefsFinaux = [
          ...new Set([...motsClefs.propres, ...motsClefs.bds]),
        ];
        await f(motsClefsFinaux);
      }
    };

    const fFinalePropres = async (mots: string[]) => {
      motsClefs.propres = mots;
      await fFinale();
    };
    const fOublierMotsClefsPropres = await this.client.suivreBdListeDeClef({
      id: idProjet,
      clef: "motsClefs",
      schéma: { type: "string" },
      f: fFinalePropres,
    });

    const fFinaleBds = async (mots: string[]) => {
      motsClefs.bds = mots;
      await fFinale();
    };
    const fListe = async (
      fSuivreRacine: (éléments: string[]) => Promise<void>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsProjet({ id: idProjet, f: fSuivreRacine });
    };
    const fBranche = async (
      idBd: string,
      fSuivi: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreMotsClefsBd({ id: idBd, f: fSuivi });
    };
    const fOublierMotsClefsBds = await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinaleBds,
      fBranche,
    });

    return async () => {
      await fOublierMotsClefsPropres();
      await fOublierMotsClefsBds();
    };
  }

  @cacheSuivi
  async suivreBdsProjet({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    return await this.client.suivreBdListeDeClef<string>({
      id,
      clef: "bds",
      schéma: { type: "string" },
      f,
    });
  }

  @cacheSuivi
  async suivreVariablesProjet({
    id,
    f,
  }: {
    id: string;
    f: schémaFonctionSuivi<string[]>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (variables?: string[]) => {
      return await f(variables || []);
    };
    const fBranche = async (
      idBd: string,
      f: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreVariablesBd({ id: idBd, f });
    };
    const fSuivreBds = async ({
      id,
      fSuivreBd,
    }: {
      id: string;
      fSuivreBd: schémaFonctionSuivi<string[]>;
    }) => {
      return await this.client.suivreBdsDeBdListe({
        id,
        f: fSuivreBd,
        fBranche,
      });
    };
    return await this.client.suivreBdDeClef({
      id,
      clef: "bds",
      f: fFinale,
      fSuivre: fSuivreBds,
    });
  }

  @cacheSuivi
  async suivreQualitéProjet({
    idProjet,
    f,
  }: {
    idProjet: string;
    f: schémaFonctionSuivi<number>;
  }): Promise<schémaFonctionOublier> {
    const fFinale = async (scoresBds: number[]) => {
      await f(
        scoresBds.length
          ? scoresBds.reduce((a, b) => a + b, 0) / scoresBds.length
          : 0
      );
    };
    const fListe = async (
      fSuiviListe: schémaFonctionSuivi<string[]>
    ): Promise<schémaFonctionOublier> => {
      return await this.suivreBdsProjet({ id: idProjet, f: fSuiviListe });
    };
    const fBranche = async (
      idBd: string,
      fSuiviBranche: schémaFonctionSuivi<number>
    ): Promise<schémaFonctionOublier> => {
      return await this.client.bds!.suivreScoreBd({
        id: idBd,
        f: (score) => fSuiviBranche(score.total),
      });
    };
    const fRéduction = (scores: number[]) => {
      return scores.flat();
    };
    return await this.client.suivreBdsDeFonctionListe({
      fListe,
      f: fFinale,
      fBranche,
      fRéduction,
    });
  }

  async exporterDonnées({
    id,
    langues,
    nomFichier,
  }: {
    id: string;
    langues?: string[];
    nomFichier?: string;
  }): Promise<donnéesProjetExportées> {
    if (!nomFichier) {
      const nomsBd = await uneFois(
        (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
          this.suivreNomsProjet({ id, f })
      );
      const idCourt = id.split("/").pop()!;

      nomFichier = langues ? traduire(nomsBd, langues) || idCourt : idCourt;
    }
    const données: donnéesProjetExportées = {
      docs: [],
      fichiersSFIP: new Set(),
      nomFichier,
    };
    const idsBds = await uneFois((f: schémaFonctionSuivi<string[]>) =>
      this.suivreBdsProjet({ id, f })
    );
    for (const idBd of idsBds) {
      const { doc, fichiersSFIP } = await this.client.bds!.exporterDonnées({
        id: idBd,
        langues,
      });

      let nom: string;
      const idCourtBd = idBd.split("/").pop()!;
      if (langues) {
        const noms = await uneFois(
          (f: schémaFonctionSuivi<{ [key: string]: string }>) =>
            this.client.bds!.suivreNomsBd({ id: idBd, f })
        );

        nom = traduire(noms, langues) || idCourtBd;
      } else {
        nom = idCourtBd;
      }
      données.docs.push({ doc, nom });

      for (const fichier of fichiersSFIP) {
        données.fichiersSFIP.add(fichier);
      }
    }
    return données;
  }

  async exporterDocumentDonnées({
    données,
    formatDoc,
    dossier = "",
    inclureFichiersSFIP = true,
  }: {
    données: donnéesProjetExportées;
    formatDoc: BookType | "xls";
    dossier?: string;
    inclureFichiersSFIP?: boolean;
  }): Promise<void> {
    const { docs, fichiersSFIP, nomFichier } = données;

    const conversionsTypes: { [key: string]: BookType } = {
      xls: "biff8",
    };
    const bookType: BookType = conversionsTypes[formatDoc] || formatDoc;

    const fichiersDocs = docs.map((d) => {
      return {
        nom: `${d.nom}.${formatDoc}`,
        octets: writeXLSX(d.doc, { bookType, type: "buffer" }),
      };
    });
    const fichiersDeSFIP = inclureFichiersSFIP
      ? await Promise.all(
          [...fichiersSFIP].map(async (fichier) => {
            return {
              nom: `${fichier.cid}.${fichier.ext}`,
              octets: await toBuffer(
                this.client.obtItérableAsyncSFIP({ id: fichier.cid })
              ),
            };
          })
        )
      : [];
    await zipper(fichiersDocs, fichiersDeSFIP, path.join(dossier, nomFichier));
  }

  async effacerProjet({ id }: { id: string }): Promise<void> {
    // D'abord effacer l'entrée dans notre liste de projets
    await this.enleverDeMesProjets({ idProjet: id });

    // Et puis maintenant aussi effacer les données et le projet lui-même
    for (const clef in ["noms", "descriptions", "motsClefs", "bds"]) {
      const idBd = await this.client.obtIdBd({
        nom: clef,
        racine: id,
      });
      if (idBd) await this.client.effacerBd({ id: idBd });
    }

    await this.client.effacerBd({ id });
  }
}
