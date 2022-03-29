import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { step } from "mocha-steps";
import fs from "fs";
import path from "path";
import { WorkBook, BookType, readFile } from "xlsx";
import AdmZip from "adm-zip";
import tmp from "tmp";
import rmrf from "rimraf"

import KeyValueStore from "orbit-db-kvstore";
import FeedStore from "orbit-db-feedstore";

import { enregistrerContrôleurs } from "@/accès";
import ClientConstellation from "@/client";
import ImportateurFeuilleCalcul from "@/importateur/xlsx"
import { uneFois, schémaFonctionSuivi } from "@/utils";
import { SpécificationAutomatisation } from "@/automatisation";

import { testAPIs, config } from "./sfipTest";
import { générerClients, typesClients, attendreFichierExiste, attendreFichierModifié } from "./utils";

chai.should();
chai.use(chaiAsPromised);

const vérifierDonnéesTableau = (
  doc: string | WorkBook, tableau: string, données: {[key: string]: string | number }[]
): void => {
  if (typeof doc === "string") {
    expect(fs.existsSync(doc)).to.be.true;
    doc = readFile(doc);
  }
  const importateur = new ImportateurFeuilleCalcul(doc);

  const cols = importateur.obtColsTableau(tableau);
  const donnéesFichier = importateur.obtDonnées(tableau, cols);

  expect(donnéesFichier).to.have.deep.members(données);
}

const vérifierDonnéesBd = (
  doc: string | WorkBook, données: { [key: string]: { [key: string]: string | number }[] }
): void => {
  if (typeof doc === "string") {
    expect(fs.existsSync(doc));
    doc = readFile(doc);
  }
  for (const tableau of Object.keys(données)) {
    vérifierDonnéesTableau(doc, tableau, données[tableau]);
  }
}

const vérifierDonnéesProjet = async (
  doc: string, données: { [key: string]: { [key: string]: { [key: string]: string | number }[] } }
): Promise<void> => {
  const zip = await new Promise<AdmZip>(résoudre => {
    const interval = setInterval(() => {
      let zip: AdmZip
      try {
        zip = new AdmZip(doc)
        clearInterval(interval);
        résoudre(zip);
      } catch {
        // Réessayer
      }
    }, 10);
  });
  const fichierExtrait = tmp.dirSync();
  zip.extractAllTo(fichierExtrait.name, true);

  try {
    for (const fichierBd of Object.keys(données)) {
      vérifierDonnéesBd(path.join(fichierExtrait.name, fichierBd), données[fichierBd]);
    }
  } catch(e) {
    fichierExtrait.removeCallback();
    throw e
  }
}

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    Object.keys(testAPIs).forEach((API) => {
      describe("Automatisation", function () {
        this.timeout(config.timeout);

        let fOublierClients: () => Promise<void>;
        let clients: ClientConstellation[];
        let client: ClientConstellation;

        before(async () => {
          enregistrerContrôleurs();
          ({ fOublier: fOublierClients, clients } = await générerClients(
            1,
            API,
            type
          ));
          client = clients[0];
        });

        after(async () => {
          if (fOublierClients) await fOublierClients();
          rmrf.sync(path.join(__dirname, "_temp"));
        });

        describe("Importation", function () {
          before(async () => {});

          step("Aucune automatisation pour commencer");
          step("Ajout automatisation détecté");
          step("Importation selon fréquence");
          step("Importation selon changements");
          step("Effacer automatisation");
        });

        describe("Exportation", function () {
          let idVariable: string;
          let idCol: string;
          let idTableau: string;
          let idBd: string;
          let idProjet: string;

          const dir = path.join(__dirname, "_temp/testExporterBd");

          before(async () => {
            idBd = await client.bds!.créerBd("ODbl-1_0");
            await client.bds!.ajouterNomsBd(idBd, { fr: "Ma bd", es: "Mi bd"});

            idTableau = await client.bds!.ajouterTableauBd(idBd);
            await client.tableaux!.ajouterNomsTableau(idTableau, { fr: "météo" });

            idVariable = await client.variables!.créerVariable("numérique");
            idCol = await client.tableaux!.ajouterColonneTableau(idTableau, idVariable);
            await client.variables!.ajouterNomsVariable(idVariable, { fr: "précipitation" });
            await client.tableaux!.ajouterÉlément(idTableau, {
              [idCol]: 3
            });

            idProjet = await client.projets!.créerProjet();
            await client.projets!.ajouterBdProjet(idProjet, idBd);
            await client.projets!.ajouterNomsProjet(idProjet, { fr: "Mon projet"})
          })

          after(async () => {
            const automatisations = await uneFois(
              async (fSuivi: schémaFonctionSuivi<SpécificationAutomatisation[]>) => await client.automatisations!.suivreAutomatisations(fSuivi)
            )
            await Promise.all(automatisations.map(async a=> await client.automatisations!.annulerAutomatisation(a.id)))
          })

          step("Exportation tableau", async () => {
            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
              idTableau,
              "tableau",
              "ods",
              false,
              dir,
              ["fr"],
            );
            const fichier = path.join(dir, "météo.ods");
            await attendreFichierExiste(fichier);
            vérifierDonnéesTableau(
              fichier,
              "météo",
              [{précipitation: 3}]
            );

            await client.automatisations!.annulerAutomatisation(idAuto);
          });

          step("Exportation BD", async () => {
            const fichier = path.join(dir, "Ma bd.ods");
            await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              dir,
              ["fr"]
            )
            await attendreFichierExiste(fichier);
            vérifierDonnéesBd(
              fichier,
              { météo: [ { précipitation: 3 } ] }
            );
          });

          step("Exportation projet", async () => {
            const fichier = path.join(dir, "Mon projet.zip");
            const idAuto = await client.automatisations!.ajouterAutomatisationExporter(
              idProjet,
              "projet",
              "ods",
              false,
              dir,
              ["fr"]
            )
            await attendreFichierExiste(fichier);
            await vérifierDonnéesProjet(
              fichier,
              {
                "Ma bd.ods": {
                  météo: [ {  précipitation: 3 } ]
                }
              }
            );

            await client.automatisations!.annulerAutomatisation(idAuto);
          });

          step("Exportation selon changements", async () => {
            const fichier = path.join(dir, "Ma bd.ods");

            const avant = Date.now();
            await client.tableaux!.ajouterÉlément(
              idTableau, { [idCol]: 5 }
            );

            await attendreFichierModifié(
              fichier,
              avant
            );

            vérifierDonnéesBd(
              fichier,
              { météo: [ { précipitation: 3 }, { précipitation: 5 } ] }
            );
          });

          step("Exportation selon fréquence", async () => {
            const fichier = path.join(dir, "Mi bd.ods");

            await client.automatisations!.ajouterAutomatisationExporter(
              idBd,
              "bd",
              "ods",
              false,
              dir,
              ["es"],
              {
                unités: "secondes",
                n: 0.3
              },
            )
            await attendreFichierExiste(fichier);
            console.log("existe");

            const maintenant = Date.now();
            await client.tableaux!.ajouterÉlément(
              idTableau, { [idCol]: 7 }
            );
            console.log("modifié");
            await attendreFichierModifié(fichier, maintenant);
            console.log("modification détectée");

            const après = Date.now();
            expect (après - maintenant).to.be.greaterThanOrEqual(0.3 * 1000)
          });
        });

        describe("Exportation nuée bds", function () {
          step("Exportation selon fréquence");
          step("Exportation selon changements");
        });

        describe("Suivre état automatisations", function () {
          it("erreur");
          it("écoute");
          it("sync");
          it("programmée");
        });
      });
    });
  });
});
