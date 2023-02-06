import type XLSX from "xlsx";
import fs from "fs";
import path from "path";
import rmrf from "rimraf";
import AdmZip from "adm-zip";
import isArray from "lodash/isArray";
import isSet from "lodash/isSet";

import type ClientConstellation from "@/client.js";
import {
  schémaFonctionSuivi,
  schémaFonctionOublier,
  adresseOrbiteValide,
  uneFois,
} from "@/utils/index.js";
import type { InfoColAvecCatégorie } from "@/tableaux.js";
import type { infoScore, schémaSpécificationBd, infoTableauAvecId } from "@/bds.js";
import type { élémentBdListeDonnées } from "@/tableaux.js";
import type { élémentDonnées, règleBornes } from "@/valid.js";

import {
  générerClients,
  AttendreRésultat,
  typesClients,
  dirRessourcesTests,
  obtDirTempoPourTest,
} from "@/utilsTests/index.js";

import { config } from "@/utilsTests/sfipTest.js";

typesClients.forEach((type) => {
  describe("Client " + type, function () {
    describe("BDs", function () {
      let fOublierClients: () => Promise<void>;
      let clients: ClientConstellation[];
      let client: ClientConstellation;

      let idBd: string;
      let accèsBd: boolean;

      const fsOublier: schémaFonctionOublier[] = [];

      beforeAll(async () => {
        ({ fOublier: fOublierClients, clients } = await générerClients(
          1,
          type
        ));
        client = clients[0];
      }, config.patienceInit);

      afterAll(async () => {
        if (fOublierClients) await fOublierClients();
        await Promise.all(fsOublier.map((f) => f()));
      });

      test(
        "Création",
        async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          expect(adresseOrbiteValide(idBd)).toBe(true);
        },
        config.patience
      );
      test(
        "Accès",
        async () => {
          fsOublier.push(
            await client.suivrePermissionÉcrire({
              id: idBd,
              f: (x) => (accèsBd = x),
            })
          );
          expect(accèsBd).toBe(true);
        },
        config.patience
      );

      describe("Mes BDs", () => {
        let fOublier: schémaFonctionOublier;
        let bds: string[];
        let idNouvelleBd: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreBds({
            f: (_bds) => (bds = _bds),
          });
        });
        afterAll(async () => {
          if (fOublier) await fOublier();
        });
        test("La BD déjà créée est présente", async () => {
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
          expect(bds[0]).toEqual(idBd);
        });
        test(
          "On crée une autre BD sans l'ajouter",
          async () => {
            idNouvelleBd = await client.bds!.créerBd({
              licence: "ODbl-1_0",
              ajouter: false,
            });
            expect(isArray(bds)).toBe(true);
            expect(bds).toHaveLength(1);
            expect(bds[0]).toEqual(idBd);
          },
          config.patience
        );
        test("On peut l'ajouter ensuite à mes bds", async () => {
          await client.bds!.ajouterÀMesBds({ id: idNouvelleBd });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(2);
          expect(bds).toEqual(expect.arrayContaining([idNouvelleBd, idBd]));
        });
        test("On peut aussi l'effacer", async () => {
          await client.bds!.effacerBd({ id: idNouvelleBd });
          expect(isArray(bds)).toBe(true);
          expect(bds).toHaveLength(1);
          expect(bds[0]).toEqual(idBd);
        });
      });

      describe("Noms", function () {
        let noms: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreNomsBd({
            id: idBd,
            f: (n) => (noms = n),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Pas de noms pour commencer", async () => {
          expect(Object.keys(noms)).toHaveLength(0);
        });

        test("Ajouter un nom", async () => {
          await client.bds!.sauvegarderNomBd({
            id: idBd,
            langue: "fr",
            nom: "Alphabets",
          });
          expect(noms.fr).toEqual("Alphabets");
        });

        test("Ajouter des noms", async () => {
          await client.bds!.ajouterNomsBd({
            id: idBd,
            noms: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(noms).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        test("Changer un nom", async () => {
          await client.bds!.sauvegarderNomBd({
            id: idBd,
            langue: "fr",
            nom: "Systèmes d'écriture",
          });
          expect(noms?.fr).toEqual("Systèmes d'écriture");
        });

        test("Effacer un nom", async () => {
          await client.bds!.effacerNomBd({ id: idBd, langue: "fr" });
          expect(noms).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Descriptions", function () {
        let descrs: { [key: string]: string };
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreDescrBd({
            id: idBd,
            f: (d) => (descrs = d),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Aucune description pour commencer", async () => {
          expect(Object.keys(descrs)).toHaveLength(0);
        });

        test("Ajouter une description", async () => {
          await client.bds!.sauvegarderDescrBd({
            id: idBd,
            langue: "fr",
            descr: "Alphabets",
          });
          expect(descrs.fr).toEqual("Alphabets");
        });

        test("Ajouter des descriptions", async () => {
          await client.bds!.ajouterDescriptionsBd({
            id: idBd,
            descriptions: {
              த: "எழுத்துகள்",
              हिं: "वर्णमाला",
            },
          });
          expect(descrs).toEqual({
            fr: "Alphabets",
            த: "எழுத்துகள்",
            हिं: "वर्णमाला",
          });
        });

        test("Changer une description", async () => {
          await client.bds!.sauvegarderDescrBd({
            id: idBd,
            langue: "fr",
            descr: "Systèmes d'écriture",
          });
          expect(descrs?.fr).toEqual("Systèmes d'écriture");
        });

        test("Effacer une description", async () => {
          await client.bds!.effacerDescrBd({ id: idBd, langue: "fr" });
          expect(descrs).toEqual({ த: "எழுத்துகள்", हिं: "वर्णमाला" });
        });
      });

      describe("Mots-clefs", function () {
        let motsClefs: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreMotsClefsBd({
            id: idBd,
            f: (m) => (motsClefs = m),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });
        test("Pas de mots-clefs pour commencer", async () => {
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
        test("Ajout d'un mot-clef", async () => {
          idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd,
            idsMotsClefs: idMotClef,
          });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(1);
        });
        test("Effacer un mot-clef", async () => {
          await client.bds!.effacerMotClefBd({ idBd, idMotClef });
          expect(isArray(motsClefs)).toBe(true);
          expect(motsClefs).toHaveLength(0);
        });
      });

      describe("Changer licence BD", function () {
        let idBd: string;
        let licence: string;
        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          fOublier = await client.bds!.suivreLicence({
            id: idBd,
            f: (l) => (licence = l),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Licence originale présente", async () => {
          expect(licence).toEqual("ODbl-1_0");
        });

        test("Changement de licence", async () => {
          await client.bds!.changerLicenceBd({ idBd, licence: "ODC-BY-1_0" });
          expect(licence).toEqual("ODC-BY-1_0");
        });
      });

      describe("Statut BD", function () {
        test.todo("À faire");
      });

      describe("Tableaux", function () {
        let tableaux: infoTableauAvecId[];
        let idTableau: string;
        let accèsTableau: boolean;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              id: idBd,
              f: (t) => (tableaux = t),
            })
          );
        });

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Pas de tableaux pour commencer", async () => {
          expect(isArray(tableaux)).toBe(true);
          expect(tableaux).toHaveLength(0);
        });

        test("Ajout d'un tableau", async () => {
          idTableau = await client.bds!.ajouterTableauBd({
            idBd,
            clefTableau: "abc",
          });
          expect(adresseOrbiteValide(idTableau)).toBe(true);
          expect(isArray(tableaux)).toBe(true);
          expect(tableaux).toHaveLength(1);
          expect(tableaux).toEqual(
            expect.arrayContaining([
              {
                id: idTableau,
                clef: "abc",
                position: 0,
              },
            ])
          );
        });

        test("Accès au tableau", async () => {
          fsOublier.push(
            await client.suivrePermissionÉcrire({
              id: idTableau,
              f: (x) => (accèsTableau = x),
            })
          );
          expect(accèsTableau).toBe(true);
        });

        test(
          "Effacer un tableau",
          async () => {
            await client.bds!.effacerTableauBd({ id: idBd, idTableau });
            expect(isArray(tableaux)).toBe(true);
            expect(tableaux).toHaveLength(0);
          },
          config.patience
        );
      });

      describe("Variables", function () {
        let variables: string[];
        let fOublier: schémaFonctionOublier;
        let idTableau: string;
        let idVariable: string;
        let idColonne: string;

        beforeAll(async () => {
          fOublier = await client.bds!.suivreVariablesBd({
            id: idBd,
            f: (v) => (variables = v),
          });
        });

        afterAll(async () => {
          if (fOublier) await fOublier();
        });
        test("Pas de variables pour commencer", async () => {
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(0);
        });
        test(
          "Ajout d'un tableau et d'une variable",
          async () => {
            idTableau = await client.bds!.ajouterTableauBd({ idBd });
            idVariable = await client.variables!.créerVariable({
              catégorie: "numérique",
            });

            idColonne = await client.tableaux!.ajouterColonneTableau({
              idTableau,
              idVariable,
            });

            expect(isArray(variables)).toBe(true);
            expect(variables).toHaveLength(1);
            expect(variables[0]).toEqual(idVariable);
          },
          config.patience
        );
        test("Effacer une variable", async () => {
          await client.tableaux!.effacerColonneTableau({
            idTableau,
            idColonne,
          });
          expect(isArray(variables)).toBe(true);
          expect(variables).toHaveLength(0);
        });
      });

      describe("Copier BD", function () {
        let idBdOrig: string;
        let idBdCopie: string;

        let idMotClef: string;
        let idVariable: string;
        let idTableau: string;

        let noms: { [key: string]: string };
        let descrs: { [key: string]: string };
        let licence: string;
        let motsClefs: string[];
        let variables: string[];
        let tableaux: infoTableauAvecId[];

        const réfNoms = {
          த: "மழை",
          हिं: "बारिश",
        };
        const réfDescrs = {
          த: "தினசரி மழை",
          हिं: "दैनिक बारिश",
        };
        const réfLicence = "ODbl-1_0";

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idBdOrig = await client.bds!.créerBd({ licence: réfLicence });

          await client.bds!.ajouterNomsBd({ id: idBdOrig, noms: réfNoms });
          await client.bds!.ajouterDescriptionsBd({
            id: idBdOrig,
            descriptions: réfDescrs,
          });

          idMotClef = await client.motsClefs!.créerMotClef();
          await client.bds!.ajouterMotsClefsBd({
            idBd: idBdOrig,
            idsMotsClefs: idMotClef,
          });

          idTableau = await client.bds!.ajouterTableauBd({ idBd: idBdOrig });

          idVariable = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          await client.tableaux!.ajouterColonneTableau({
            idTableau,
            idVariable,
          });

          idBdCopie = await client.bds!.copierBd({ id: idBdOrig });

          fsOublier.push(
            await client.bds!.suivreNomsBd({
              id: idBdCopie,
              f: (x) => (noms = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreDescrBd({
              id: idBdCopie,
              f: (x) => (descrs = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreLicence({
              id: idBdCopie,
              f: (x) => (licence = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreMotsClefsBd({
              id: idBdCopie,
              f: (x) => (motsClefs = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreVariablesBd({
              id: idBdCopie,
              f: (x) => (variables = x),
            })
          );
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              id: idBdCopie,
              f: (x) => (tableaux = x),
            })
          );
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Les noms sont copiés", async () => {
          expect(noms).toEqual(réfNoms);
        });
        test("Les descriptions sont copiées", async () => {
          expect(descrs).toEqual(réfDescrs);
        });
        test("La licence est copiée", async () => {
          expect(licence).toEqual(réfLicence);
        });
        test("Les mots-clefs sont copiés", async () => {
          expect(motsClefs).toEqual(expect.arrayContaining([idMotClef]));
        });
        test("Les tableaux sont copiés", async () => {
          expect(isArray(tableaux)).toBe(true);
          expect(tableaux).toHaveLength(1);
        });
        test("Les variables sont copiées", async () => {
          expect(variables).toEqual(expect.arrayContaining([idVariable]));
        });
      });

      describe("Combiner BDs", function () {
        let idVarClef: string;
        let idVarTrad: string;

        let idBd1: string;
        let idBd2: string;

        let idTableau1: string;
        let idTableau2: string;

        let données1: élémentDonnées<élémentBdListeDonnées>[];

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            tableaux: [
              {
                cols: [
                  {
                    idVariable: idVarClef,
                    idColonne: "clef",
                    index: true,
                  },
                  {
                    idVariable: idVarTrad,
                    idColonne: "trad",
                  },
                ],
                clef: "tableau trads",
              },
            ],
          };

          idBd1 = await client.bds!.créerBdDeSchéma({ schéma });
          idBd2 = await client.bds!.créerBdDeSchéma({ schéma });

          idTableau1 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  id: idBd1,
                  f: fSuivi,
                });
              }
            )
          )[0].id;
          idTableau2 = (
            await uneFois(
              async (
                fSuivi: schémaFonctionSuivi<infoTableauAvecId[]>
              ): Promise<schémaFonctionOublier> => {
                return await client.bds!.suivreTableauxBd({
                  id: idBd2,
                  f: fSuivi,
                });
              }
            )
          )[0].id;

          type élémentTrad = { clef: string; trad?: string };

          const éléments1: élémentTrad[] = [
            {
              clef: "fr",
              trad: "Constellation",
            },
            {
              clef: "kaq", // Une trad vide, par erreur disons
            },
          ];
          for (const élément of éléments1) {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableau1,
              vals: élément,
            });
          }

          const éléments2: élémentTrad[] = [
            {
              clef: "fr",
              trad: "Constellation!", // Une erreur ici, disons
            },
            {
              clef: "kaq",
              trad: "Ch'umil",
            },
            {
              clef: "हिं",
              trad: "तारामंडल",
            },
          ];
          for (const élément of éléments2) {
            await client.tableaux!.ajouterÉlément({
              idTableau: idTableau2,
              vals: élément,
            });
          }

          fsOublier.push(
            await client.tableaux!.suivreDonnées({
              idTableau: idTableau1,
              f: (d) => (données1 = d),
              clefsSelonVariables: true,
            })
          );

          await client.bds!.combinerBds({ idBdBase: idBd1, idBd2 });
        }, config.patience);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Les données sont copiées", async () => {
          const donnéesCombinées = données1.map((d) => d.données);
          const donnéesSansId = donnéesCombinées.map((d) => {
            delete d.id;
            return d;
          });
          expect(isArray(donnéesSansId)).toBe(true);

          expect(donnéesSansId).toHaveLength(3);
          expect(donnéesSansId).toEqual(
            expect.arrayContaining([
              { [idVarClef]: "fr", [idVarTrad]: "Constellation" },
              { [idVarClef]: "kaq", [idVarTrad]: "Ch'umil" },
              { [idVarClef]: "हिं", [idVarTrad]: "तारामंडल" },
            ])
          );
        });
      });

      describe("Créer BD de schéma", function () {
        let idVarClef: string;
        let idVarTrad: string;
        let idVarLangue: string;

        let idMotClef: string;

        let idBd: string;

        let tableaux: infoTableauAvecId[];
        let tableauUnique: string | undefined;

        const fsOublier: schémaFonctionOublier[] = [];

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          idMotClef = await client.motsClefs!.créerMotClef();

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            motsClefs: [idMotClef],
            tableaux: [
              {
                cols: [
                  {
                    idVariable: idVarClef,
                    idColonne: "clef",
                    index: true,
                  },
                  {
                    idVariable: idVarTrad,
                    idColonne: "trad",
                  },
                ],
                clef: "tableau trads",
              },
              {
                cols: [
                  {
                    idVariable: idVarLangue,
                    idColonne: "langue",
                    index: true,
                  },
                ],
                clef: "tableau langues",
              },
            ],
          };

          idBd = await client.bds!.créerBdDeSchéma({ schéma });
          fsOublier.push(
            await client.bds!.suivreTableauxBd({
              id: idBd,
              f: (t) => (tableaux = t),
            })
          );
          fsOublier.push(
            await client.bds!.suivreIdTableauParClef({
              idBd,
              clef: "tableau trads",
              f: (t) => (tableauUnique = t),
            })
          );
        }, config.patience * 2);

        afterAll(async () => {
          await Promise.all(fsOublier.map((f) => f()));
        });

        test("Les tableaux sont créés", async () => {
          expect(isArray(tableaux)).toBe(true);
          expect(tableaux).toHaveLength(2);
        });

        test("Colonnes", async () => {
          const colonnes = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<InfoColAvecCatégorie[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.tableaux!.suivreColonnes({
                idTableau: tableaux[0].id,
                f: fSuivi,
              });
            }
          );

          const idsColonnes = colonnes.map((c) => c.id);
          expect(isArray(idsColonnes)).toBe(true);

          expect(idsColonnes).toHaveLength(2);
          expect(idsColonnes).toEqual(expect.arrayContaining(["clef", "trad"]));
        });

        test("Mots clefs", async () => {
          const motsClefs = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.bds!.suivreMotsClefsBd({
                id: idBd,
                f: fSuivi,
              });
            }
          );
          expect(isArray(motsClefs)).toBe(true);

          expect(motsClefs).toHaveLength(1);
          expect(motsClefs).toEqual(expect.arrayContaining([idMotClef]));
        });

        test("Index colonne", async () => {
          const indexes = await uneFois(
            async (
              fSuivi: schémaFonctionSuivi<string[]>
            ): Promise<schémaFonctionOublier> => {
              return await client.tableaux!.suivreIndex({
                idTableau: tableaux[0].id,
                f: fSuivi,
              });
            }
          );
          expect(isArray(indexes)).toBe(true);

          expect(indexes).toHaveLength(1);
          expect(indexes).toEqual(expect.arrayContaining(["clef"]));
        });

        test("Tableaux unique détectable", async () => {
          expect(adresseOrbiteValide(tableauUnique)).toBe(true);
        });
      });

      describe("Suivre BD unique", function () {
        let idVarClef: string;
        let idVarTrad: string;
        let idVarLangue: string;

        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<string>();

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarLangue = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          const idNuée = await client.nuées!.créerNuée({});

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            tableaux: [
              {
                cols: [
                  {
                    idVariable: idVarClef,
                    idColonne: "clef",
                    index: true,
                  },
                  {
                    idVariable: idVarTrad,
                    idColonne: "trad",
                  },
                ],
                clef: "tableau trads",
              },
              {
                cols: [
                  {
                    idVariable: idVarLangue,
                    idColonne: "langue",
                    index: true,
                  },
                ],
                clef: "tableau langues",
              },
            ],
          };

          fOublier = await client.bds!.suivreBdUnique({
            schéma,
            idNuéeUnique: idNuée,
            f: (id) => rés.mettreÀJour(id),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });
        test(
          "La BD est créée lorsqu'elle n'existe pas",
          async () => {
            await rés.attendreExiste();
            expect(adresseOrbiteValide(rés.val)).toBe(true);
          },
          config.patience
        );
        test.todo("Gestion de la concurrence entre dispositifs");
        test.todo("Gestion de concurrence entre 2+ BDs");
      });

      describe("Suivre tableau unique", function () {
        let idBd: string;
        let idTableau: string;

        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<string>();

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          idTableau = await client.bds!.ajouterTableauBd({ idBd });

          fOublier = await client.bds!.suivreIdTableauParClef({
            idBd: idBd,
            clef: "clefUnique",
            f: (id) => rés.mettreÀJour(id),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });
        test("Rien pour commencer", async () => {
          expect(rés.val).toBeUndefined;
        });
        test("Ajout de clef détecté", async () => {
          await client.bds!.spécifierClefTableau({
            idBd,
            idTableau,
            clef: "clefUnique",
          });
          await rés.attendreExiste();
          expect(rés.val).toEqual(idTableau);
        });
      });

      describe("Suivre tableau unique de BD unique", function () {
        let idVarClef: string;
        let idVarTrad: string;

        let fOublier: schémaFonctionOublier;

        const rés = new AttendreRésultat<string>();

        beforeAll(async () => {
          idVarClef = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });
          idVarTrad = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          const idNuée = await client.nuées!.créerNuée({});

          const schéma: schémaSpécificationBd = {
            licence: "ODbl-1_0",
            tableaux: [
              {
                cols: [
                  {
                    idVariable: idVarClef,
                    idColonne: "clef",
                    index: true,
                  },
                  {
                    idVariable: idVarTrad,
                    idColonne: "trad",
                  },
                ],
                clef: "id tableau unique",
              },
            ],
          };

          fOublier = await client.bds!.suivreIdTableauParClefDeBdUnique({
            schémaBd: schéma,
            idNuéeUnique: idNuée,
            clefTableau: "id tableau unique",
            f: (id) => rés.mettreÀJour(id),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
          rés.toutAnnuler();
        });

        test(
          "Tableau unique détecté",
          async () => {
            await rés.attendreExiste();
            expect(adresseOrbiteValide(rés.val)).toBe(true);
          },
          config.patience
        );
      });

      describe("Score", function () {
        let idBd: string;
        let idTableau: string;
        let idVarNumérique: string;
        let idVarChaîne: string;
        let idVarNumérique2: string;

        let idColNumérique: string;
        let idColNumérique2: string;

        let score: infoScore;

        let fOublier: schémaFonctionOublier;

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });
          idTableau = await client.bds!.ajouterTableauBd({ idBd });

          idVarNumérique = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarNumérique2 = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          idVarChaîne = await client.variables!.créerVariable({
            catégorie: "chaîne",
          });

          fOublier = await client.bds!.suivreScoreBd({
            id: idBd,
            f: (s) => (score = s),
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        describe("Score accessibilité", function () {
          test.todo("À faire");
        });

        describe("Score couverture tests", function () {
          test("`undefined` lorsque aucune colonne", async () => {
            expect(score.couverture).toBeUndefined;
          });

          test(
            "Ajout de colonnes",
            async () => {
              idColNumérique = await client.tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable: idVarNumérique,
              });
              idColNumérique2 = await client.tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable: idVarNumérique2,
              });
              await client.tableaux!.ajouterColonneTableau({
                idTableau,
                idVariable: idVarChaîne,
              });
              expect(score.couverture).toEqual(0);
            },
            config.patience
          );

          test(
            "Ajout de règles",
            async () => {
              const règleNumérique: règleBornes = {
                typeRègle: "bornes",
                détails: { type: "fixe", val: 0, op: ">=" },
              };
              await client.tableaux!.ajouterRègleTableau({
                idTableau,
                idColonne: idColNumérique,
                règle: règleNumérique,
              });
              expect(score.couverture).toEqual(0.5);

              await client.tableaux!.ajouterRègleTableau({
                idTableau,
                idColonne: idColNumérique2,
                règle: règleNumérique,
              });
              expect(score.couverture).toEqual(1);
            },
            config.patience
          );
        });

        describe("Score validité", function () {
          let empreinteÉlément: string;

          test("`undefined` pour commencer", async () => {
            expect(score.valide).toBeUndefined;
          });

          test("Ajout d'éléments", async () => {
            empreinteÉlément = await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColNumérique]: -1,
                [idColNumérique2]: 1,
              },
            });
            expect(score.valide).toEqual(0.5);
            await client.tableaux!.ajouterÉlément({
              idTableau,
              vals: {
                [idColNumérique]: 1,
              },
            });
            expect(score.valide).toEqual(2 / 3);
          });

          test("Correction des éléments", async () => {
            await client.tableaux!.modifierÉlément({
              idTableau,
              vals: { [idColNumérique]: 12 },
              empreintePrécédente: empreinteÉlément,
            });
            expect(score.valide).toEqual(1);
          });
        });

        describe("Score total", function () {
          test("Calcul du score total", async () => {
            const total =
              ((score.accès || 0) +
                (score.couverture || 0) +
                (score.valide || 0)) /
              3;
            expect(score.total).toEqual(total);
          });
        });
      });

      describe("Exporter données", function () {
        let idBd: string;
        let doc: XLSX.WorkBook;
        let fichiersSFIP: Set<{ cid: string; ext: string }>;
        let nomFichier: string;
        let cid: string;

        const nomTableau1 = "Tableau 1";
        const nomTableau2 = "Tableau 2";

        beforeAll(async () => {
          idBd = await client.bds!.créerBd({ licence: "ODbl-1_0" });

          const idTableau1 = await client.bds!.ajouterTableauBd({ idBd });
          const idTableau2 = await client.bds!.ajouterTableauBd({ idBd });

          const idVarNum = await client.variables!.créerVariable({
            catégorie: "numérique",
          });
          const idVarFichier = await client.variables!.créerVariable({
            catégorie: "fichier",
          });
          await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableau1,
            idVariable: idVarNum,
          });
          const idColFichier = await client.tableaux!.ajouterColonneTableau({
            idTableau: idTableau2,
            idVariable: idVarFichier,
          });

          const octets = fs.readFileSync(
            path.join(dirRessourcesTests(), "logo.svg")
          );
          cid = await client.ajouterÀSFIP({ fichier: octets });

          await client.tableaux!.ajouterÉlément({
            idTableau: idTableau2,
            vals: {
              [idColFichier]: {
                cid,
                ext: "svg",
              },
            },
          });

          await client.tableaux!.ajouterNomsTableau({
            idTableau: idTableau1,
            noms: {
              fr: nomTableau1,
            },
          });
          await client.tableaux!.ajouterNomsTableau({
            idTableau: idTableau2,
            noms: {
              fr: nomTableau2,
            },
          });

          ({ doc, fichiersSFIP, nomFichier } =
            await client.bds!.exporterDonnées({ id: idBd, langues: ["fr"] }));
        }, config.patience);

        test("Doc créé avec tous les tableaux", () => {
          expect(isArray(doc.SheetNames));
          expect(doc.SheetNames).toEqual(
            expect.arrayContaining([nomTableau1, nomTableau2])
          );
        });
        test("Fichiers SFIP retrouvés de tous les tableaux", () => {
          expect(isSet(fichiersSFIP)).toBe(true);
          expect(fichiersSFIP.size).toEqual(1);
          expect(fichiersSFIP).toEqual(new Set([{ cid, ext: "svg" }]));
        });

        describe("Exporter document données", function () {
          const dirTempo = obtDirTempoPourTest();
          const dirZip = path.join(dirTempo, "testExporterBd");
          const fichierExtrait = path.join(dirTempo, "testExporterBdExtrait");

          beforeAll(async () => {
            await client.bds!.exporterDocumentDonnées({
              données: { doc, fichiersSFIP, nomFichier },
              formatDoc: "ods",
              dir: dirZip,
              inclureFichiersSFIP: true,
            });
          }, config.patience);

          afterAll(() => {
            rmrf.sync(dirTempo);
          });

          test("Le fichier zip existe", () => {
            const nomZip = path.join(dirZip, nomFichier + ".zip");
            expect(fs.existsSync(nomZip)).toBe(true);
            const zip = new AdmZip(nomZip);
            zip.extractAllTo(fichierExtrait, true);
            expect(fs.existsSync(fichierExtrait)).toBe(true);
          });

          test("Les données sont exportées", () => {
            expect(
              fs.existsSync(path.join(fichierExtrait, nomFichier + ".ods"))
            ).toBe(true);
          });

          test("Le dossier pour les données SFIP existe", () => {
            expect(fs.existsSync(path.join(fichierExtrait, "sfip"))).toEqual(
              true
            );
          });

          test("Les fichiers SFIP existent", () => {
            expect(
              fs.existsSync(path.join(fichierExtrait, "sfip", cid + ".svg"))
            ).toBe(true);
          });
        });
      });

      describe("Rechercher BDs par mot-clef", function () {
        let résultats: string[];
        let fOublier: schémaFonctionOublier;
        let idMotClef: string;
        let idBdRechercheMotsClefs: string;

        beforeAll(async () => {
          idMotClef = await client.motsClefs!.créerMotClef();

          fOublier = await client.bds!.rechercherBdsParMotsClefs({
            motsClefs: [idMotClef],
            f: (r) => (résultats = r),
          });

          idBdRechercheMotsClefs = await client.bds!.créerBd({
            licence: "ODbl-1_0",
          });
        }, config.patience);

        afterAll(async () => {
          if (fOublier) await fOublier();
        });

        test("Pas de résultats pour commencer", async () => {
          expect(isArray(résultats)).toBe(true);
          expect(résultats).toHaveLength(0);
        });

        test("Ajout d'un mot-clef détecté", async () => {
          await client.bds!.ajouterMotsClefsBd({
            idBd: idBdRechercheMotsClefs,
            idsMotsClefs: [idMotClef],
          });
          expect(isArray(résultats)).toBe(true);
          expect(résultats).toHaveLength(1);
          expect(résultats[0]).toEqual(idBdRechercheMotsClefs);
        });
      });
    });
  });
});
