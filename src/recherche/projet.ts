import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  schémaFonctionSuivreObjectifRecherche,
  schémaFonctionSuiviRecherche,
  infoRésultatRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";

import { rechercherBdSelonTexte } from "@/recherche/bd.js";
import {
  rechercherVariableSelonTexte,
  rechercherVariableSelonNom,
} from "@/recherche/variable.js";
import {
  rechercherMotClefSelonTexte,
  rechercherMotClefSelonNom,
} from "@/recherche/motClef.js";
import {
  similTexte,
  combinerRecherches,
  sousRecherche,
  rechercherSelonId,
} from "@/recherche/utils.js";

export const rechercherProjetSelonNom = (
  nomProjet: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (noms: { [key: string]: string }) => {
      const corresp = similTexte(nomProjet, noms);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "nom",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.projets!.suivreNomsProjet({
      id: idProjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProjetSelonDescr = (
  descProjet: string
): schémaFonctionSuivreObjectifRecherche<infoRésultatTexte> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<infoRésultatTexte>
  ): Promise<schémaFonctionOublier> => {
    const fSuivre = (descrs: { [key: string]: string }) => {
      const corresp = similTexte(descProjet, descrs);
      if (corresp) {
        const { score, clef, info } = corresp;
        fSuivreRecherche({
          type: "résultat",
          score,
          clef,
          info,
          de: "descr",
        });
      } else {
        fSuivreRecherche();
      }
    };
    const fOublier = await client.projets!.suivreDescrProjet({
      id: idProjet,
      f: fSuivre,
    });
    return fOublier;
  };
};

export const rechercherProjetSelonIdBd = (
  idBd: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreBdsProjet({
        id: idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idBd);

    return await sousRecherche(
      "bd",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonBd = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<
    infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
  >
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<
        infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
      >
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreBdsProjet({
        id: idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherBdSelonTexte(texte);

    return await sousRecherche(
      "bd",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonIdVariable = (
  idVariable: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreVariablesProjet({
        id: idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonNomVariable = (
  nomVariable: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreVariablesProjet({
        id: idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariableSelonNom(nomVariable);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonVariable = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreVariablesProjet({
        id: idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherVariableSelonTexte(texte);

    return await sousRecherche(
      "variable",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonIdMotClef = (
  idMotClef: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreMotsClefsProjet({
        idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherSelonId(idMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonNomMotClef = (
  nomMotClef: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreMotsClefsProjet({
        idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotClefSelonNom(nomMotClef);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonMotClef = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  infoRésultatRecherche<infoRésultatTexte>
> => {
  return async (
    client: ClientConstellation,
    idProjet: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      infoRésultatRecherche<infoRésultatTexte>
    >
  ): Promise<schémaFonctionOublier> => {
    const fListe = async (
      fSuivreRacine: (idsVariables: string[]) => void
    ): Promise<schémaFonctionOublier> => {
      return await client.projets!.suivreMotsClefsProjet({
        idProjet,
        f: fSuivreRacine,
      });
    };

    const fRechercher = rechercherMotClefSelonTexte(texte);

    return await sousRecherche(
      "motClef",
      fListe,
      fRechercher,
      client,
      fSuivreRecherche
    );
  };
};

export const rechercherProjetSelonTexte = (
  texte: string
): schémaFonctionSuivreObjectifRecherche<
  | infoRésultatTexte
  | infoRésultatRecherche<
      infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
    >
> => {
  return async (
    client: ClientConstellation,
    idCompte: string,
    fSuivreRecherche: schémaFonctionSuiviRecherche<
      | infoRésultatTexte
      | infoRésultatRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
    >
  ): Promise<schémaFonctionOublier> => {
    const fRechercherNoms = rechercherProjetSelonNom(texte);
    const fRechercherDescr = rechercherProjetSelonDescr(texte);
    const fRechercherBd = rechercherProjetSelonBd(texte);
    const fRechercherVariable = rechercherProjetSelonVariable(texte);
    const fRechercherMotClef = rechercherProjetSelonMotClef(texte);
    const fRechercherId = rechercherSelonId(texte);

    return await combinerRecherches<
      | infoRésultatTexte
      | infoRésultatRecherche<
          infoRésultatTexte | infoRésultatRecherche<infoRésultatTexte>
        >
    >(
      {
        noms: fRechercherNoms,
        descr: fRechercherDescr,
        bd: fRechercherBd,
        variable: fRechercherVariable,
        motClef: fRechercherMotClef,
        id: fRechercherId,
      },
      client,
      idCompte,
      fSuivreRecherche
    );
  };
};
