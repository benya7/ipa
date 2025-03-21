import { isElectron, isElectronMain, isNode } from "wherearewe";

import {
  attente,
  attente as utilsTestAttente,
  constellation as utilsTestConstellation,
} from "@constl/utils-tests";
import { expect } from "aegir/chai";
import { créerConstellation, type Constellation } from "@/index.js";
import {
  INSTALLÉ,
  TOUS,
  ÉpingleCompte,
  type BooléenniserPropriétés,
  type ÉpingleBd,
  type ÉpingleFavoris,
  type ÉpingleFavorisAvecId,
} from "@/favoris.js";
import type { schémaFonctionOublier } from "@/types.js";

const { créerConstellationsTest } = utilsTestConstellation;

describe("Favoris", function () {
  let fOublierClients: () => Promise<void>;
  let clients: Constellation[];
  let client: Constellation;

  before(async () => {
    ({ fOublier: fOublierClients, clients } = await créerConstellationsTest({
      n: 1,

      créerConstellation,
    }));
    client = clients[0];
  });

  after(async () => {
    if (fOublierClients) await fOublierClients();
  });

  describe("estÉpingléSurDispositif", function () {
    it("tous", async () => {
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: "TOUS",
      });
      expect(épinglé).to.be.true();
    });
    it("installé", async () => {
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
      });
      if (isNode || isElectronMain) {
        expect(épinglé).to.be.true();
      } else {
        expect(épinglé).to.be.false();
      }
    });
    it("installé, pour un autre dispositif", async () => {
      const idDispositifAutre = "abc";
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: "INSTALLÉ",
        idDispositif: idDispositifAutre,
      });
      expect(épinglé).to.be.false();
    });
    it("idDispositif", async () => {
      const idDispositif = await client.obtIdDispositif();
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: idDispositif,
      });
      expect(épinglé).to.be.true();
    });
    it("listeIdDispositif", async () => {
      const idDispositif = await client.obtIdDispositif();
      const épinglé = await client.favoris.estÉpingléSurDispositif({
        dispositifs: [idDispositif],
      });
      expect(épinglé).to.be.true();
    });
  });

  describe("Épingler BDs", function () {
    let idBd: string;

    const favoris = new utilsTestAttente.AttendreRésultat<
      ÉpingleFavorisAvecId[]
    >();
    const épingleBd = new attente.AttendreRésultat<
      BooléenniserPropriétés<ÉpingleFavoris>
    >();

    const fsOublier: schémaFonctionOublier[] = [];

    before(async () => {
      idBd = await client.bds.créerBd({ licence: "ODbl-1_0", épingler: false });

      fsOublier.push(
        await client.favoris.suivreFavoris({
          f: (favs) => favoris.mettreÀJour(favs),
        }),
      );
      fsOublier.push(
        await client.favoris.suivreEstÉpingléSurDispositif({
          idObjet: idBd,
          f: (épingle) => épingleBd.mettreÀJour(épingle),
        }),
      );
    });

    after(async () => {
      await Promise.allSettled(fsOublier.map((f) => f()));
    });

    it("Juste un favori (notre propre compte) pour commencer", async () => {
      const val = await favoris.attendreExiste();

      const monCompte = await client.obtIdCompte();
      const ref: ÉpingleFavorisAvecId<ÉpingleCompte> = {
        idObjet: monCompte,
        épingle: {
          type: "compte",
          base: TOUS,
          profil: {
            type: "profil",
            base: TOUS,
            fichiers: TOUS,
          },
          favoris: TOUS,
        },
      };
      expect(val).to.have.deep.members([ref]);
    });

    it("Ajouter un favori", async () => {
      await client.bds.épinglerBd({ idBd });
      const val = await favoris.attendreQue(
        (x) => !!x.find((fv) => fv.idObjet === idBd),
      );

      const réf: ÉpingleFavorisAvecId<ÉpingleBd> = {
        idObjet: idBd,
        épingle: {
          type: "bd",
          base: TOUS,
          données: {
            tableaux: TOUS,
            fichiers: INSTALLÉ,
          },
        },
      };
      expect(val.find((fv) => fv.idObjet === idBd)).to.deep.equal(réf);

      const valÉpingleBd = await épingleBd.attendreExiste();

      const réfÉpingle: BooléenniserPropriétés<ÉpingleBd> = {
        base: true,
        données: {
          tableaux: true,
          fichiers: isElectron || isNode,
        },
      };

      expect(valÉpingleBd).to.deep.equal(réfÉpingle);
    });

    it("Enlever un favori", async () => {
      await client.favoris.désépinglerFavori({ idObjet: idBd });

      const val = await favoris.attendreQue(
        (x) => !x.find((fv) => fv.idObjet === idBd),
      );
      expect(val.length).to.equal(1);

      épingleBd.attendreNexistePas();
    });

    it("Ajouter un favori avec fichiers", async () => {
      const idc = "QmNR2n4zywCV61MeMLB6JwPueAPqheqpfiA4fLPMxouEmQ";

      const idTableau = await client.bds.ajouterTableauBd({ idBd });
      const idVarPhoto = await client.variables.créerVariable({
        catégorie: "image",
      });
      const idColPhoto = await client.tableaux.ajouterColonneTableau({
        idTableau,
        idVariable: idVarPhoto,
      });
      await client.tableaux.ajouterÉlément({
        idTableau,
        vals: {
          [idColPhoto]: idc,
        },
      });

      expect(client.épingles.estÉpinglé({ id: idc }));
    });
  });
});
