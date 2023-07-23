import type { default as ClientConstellation } from "@/client.js";
import type {
  schémaFonctionOublier,
  résultatObjectifRecherche,
  infoRésultatTexte,
} from "@/utils/index.js";
import {
  rechercherVariableSelonNom,
  rechercherVariableSelonDescr,
  rechercherVariableSelonTexte,
} from "@/recherche/variable.js";

import { générerClients } from "@/utilsTests/client.js";
import { AttendreRésultat } from "@/utilsTests/attente.js";

import { expect } from "aegir/chai";

describe("Rechercher variables", function () {
  let fOublierClients: () => Promise<void>;
  let clients: ClientConstellation[];
  let client: ClientConstellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await générerClients(1));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("Selon nom", function () {
    let idVariable: string;
    const résultat = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRecherche = rechercherVariableSelonNom("Radiation solaire");
      fOublier = await fRecherche(client, idVariable, (r) => (résultat.mettreÀJour(r)));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la variable n'a pas de nom", async () => {
      expect(résultat.val).to.be.undefined();
    });
    it("Pas de résultat si le mot-clef n'a vraiment rien à voir", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });

      expect(résultat.val).to.be.undefined();
    });
    it("Résultat si la variable est presque exacte", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          es: "Radiación solar",
        },
      });

      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "es",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: "Radiación solar",
        },
        score: 0.2,
      });
    });
    it("Résultat si le mot-clef est exacte", async () => {
      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          fr: "Radiation solaire",
        },
      });
      const val = await résultat.attendreQue(x=>x.score>0.5);
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 17,
          texte: "Radiation solaire",
        },
        score: 1,
      });
    });
  });

  describe("Selon descr", function () {
    let idVariable: string;
    const résultat = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();
    let fOublier: schémaFonctionOublier;

    before(async () => {
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRecherche = rechercherVariableSelonDescr("Radiation solaire");
      fOublier = await fRecherche(client, idVariable, (r) => (résultat.mettreÀJour(r)));
    });

    after(async () => {
      if (fOublier) await fOublier();
    });

    it("Pas de résultat quand la variable n'a pas de description", async () => {
      expect(résultat.val).to.be.undefined();
    });
    it("Pas de résultat si la description n'a vraiment rien à voir", async () => {
      await client.variables!.ajouterDescriptionsVariable({
        id: idVariable,
        descriptions: {
          த: "சூரிய கதிர்வீச்சு",
        },
      });
      expect(résultat.val).to.be.undefined();
    });
    it("Résultat si la variable est presque exacte", async () => {
      await client.variables!.ajouterDescriptionsVariable({
        id: idVariable,
        descriptions: {
          es: "Radiación solar",
        },
      });
      
      const val = await résultat.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "es",
        de: "descr",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: "Radiación solar",
        },
        score: 0.2,
      });
    });
    it("Résultat si la description est exacte", async () => {
      await client.variables!.ajouterDescriptionsVariable({
        id: idVariable,
        descriptions: {
          fr: "Radiation solaire",
        },
      });
      const val = await résultat.attendreQue(x=>x.score > 0.5)
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "descr",
        info: {
          type: "texte",
          début: 0,
          fin: 17,
          texte: "Radiation solaire",
        },
        score: 1,
      });
    });
  });

  describe("Selon texte", function () {
    let idVariable: string;
    const résultatId = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();
    const résultatNom = new AttendreRésultat<résultatObjectifRecherche<infoRésultatTexte>>();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idVariable = await client.variables!.créerVariable({
        catégorie: "numérique",
      });

      const fRechercheNom = rechercherVariableSelonTexte("précipitation");
      fsOublier.push(
        await fRechercheNom(client, idVariable, (r) => (résultatNom.mettreÀJour(r)))
      );

      const fRechercheId = rechercherVariableSelonTexte(
        idVariable.slice(0, 15)
      );
      fsOublier.push(
        await fRechercheId(client, idVariable, (r) => (résultatId.mettreÀJour(r)))
      );

      await client.variables!.ajouterNomsVariable({
        id: idVariable,
        noms: {
          fr: "précipitation",
        },
      });
    });

    after(async () => {
      await Promise.all(fsOublier.map((f) => f()));
    });

    it("Résultat nom détecté", async () => {
      
      const val = await résultatNom.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        clef: "fr",
        de: "nom",
        info: {
          type: "texte",
          début: 0,
          fin: 13,
          texte: "précipitation",
        },
        score: 1,
      });
    });

    it("Résultat id détecté", async () => {
      const val = await résultatId.attendreExiste();
      expect(val).to.deep.equal({
        type: "résultat",
        de: "id",
        info: {
          type: "texte",
          début: 0,
          fin: 15,
          texte: idVariable,
        },
        score: 1,
      });
    });
  });
});
