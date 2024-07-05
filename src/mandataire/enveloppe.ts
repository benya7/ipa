import Semaphore from "@chriscdn/promise-semaphore";

import { Constellation, optsConstellation } from "@/client.js";
import type { schémaFonctionOublier } from "@/types.js";
import {
  type MessagePourIpa,
  type MessageDIpa,
  type MessageActionDIpa,
  type MessageSuivreDIpa,
  type MessageSuivrePrêtDIpa,
  ERREUR_INIT_IPA,
} from "@constl/mandataire";
import { v4 as uuidv4 } from "uuid";

export class EnveloppeIpa {
  ipa?: Constellation;
  _messagesEnAttente: MessagePourIpa[];
  prêt: boolean;
  dicFRetourSuivi: {
    [key: string]: { fOublier: schémaFonctionOublier } & {
      [key: string]: (...args: unknown[]) => void;
    };
  };
  opts: optsConstellation;

  fsMessages: { [clef: string]: (m: MessageDIpa) => void };
  fsErreurs: {
    [clef: string]: (args: {
      erreur: string;
      idRequête?: string;
      code?: string;
    }) => void;
  };

  _verrou: Semaphore;

  constructor(
    fMessage: (m: MessageDIpa) => void,
    fErreur: (args: {
      erreur: string;
      idRequête?: string;
      code?: string;
    }) => void,
    opts: optsConstellation | Constellation = {},
  ) {
    this.fsMessages = {};
    this.fsErreurs = {};

    this.connecterÉcouteurs({
      fMessage,
      fErreur,
    });

    this.opts = opts instanceof Constellation ? {} : opts;
    if (opts instanceof Constellation) this.ipa = opts;

    this.dicFRetourSuivi = {};

    this.prêt = false;
    this._messagesEnAttente = [];
    this._verrou = new Semaphore();

    this.init();
  }

  fMessage(m: MessageDIpa) {
    Object.values(this.fsMessages).forEach((f) => f(m));
  }

  fErreur({
    erreur,
    idRequête,
    code,
  }: {
    erreur: string;
    idRequête?: string;
    code?: string;
  }) {
    Object.values(this.fsErreurs).forEach((f) =>
      f({ erreur, idRequête, code }),
    );
  }

  async init(): Promise<Constellation> {
    await this._verrou.acquire("init");

    if (this.ipa) {
      this._verrou.release("init");
      return this.ipa;
    } // Nécessaire si on a plus qu'un mandataire connecté à la même instance Constellation

    try {
      this.ipa = await Constellation.créer(this.opts);
    } catch (e) {
      this.fErreur({
        erreur: e.toString(),
        code: e.name === "Error" ? ERREUR_INIT_IPA : e.name,
      });
      throw e;
    }

    this._messagesEnAttente.forEach((m) => this._gérerMessage(m));
    this.prêt = true;

    this._verrou.release("init");
    return this.ipa;
  }

  async gérerMessage(message: MessagePourIpa): Promise<void> {
    if (this.prêt) {
      await this._gérerMessage(message);
    } else {
      this._messagesEnAttente.unshift(message);
    }
  }

  async _gérerMessage(message: MessagePourIpa): Promise<void> {
    if (!this.ipa) {
      this.fErreur({
        erreur: "IPA non initialisé",
        idRequête: message.id,
        code: ERREUR_INIT_IPA,
      });
      return;
    }

    const { type } = message;
    switch (type) {
      case "suivre": {
        const { id, fonction, args, nomArgFonction } = message;

        const fonctionIPA = this.extraireFonctionIPA(fonction, id);
        if (!fonctionIPA) return; // L'erreur est déjà envoyée par extraireFonctionIPA

        const fFinale = (données: unknown) => {
          const messageRetour: MessageSuivreDIpa = {
            type: "suivre",
            id,
            données,
          };
          this.fMessage(messageRetour);
        };

        args[nomArgFonction] = fFinale;

        try {
          const retour = (await fonctionIPA(args)) as
            | schémaFonctionOublier
            | {
                fOublier: schémaFonctionOublier;
                [key: string]: (...args: unknown[]) => void;
              };
          const retourFinal =
            typeof retour === "function" ? { fOublier: retour } : retour;

          this.dicFRetourSuivi[id] = retourFinal;
          const messageRetour: MessageSuivrePrêtDIpa = {
            type: "suivrePrêt",
            id,
          };
          if (typeof retour !== "function")
            messageRetour.fonctions = Object.keys(retour);
          this.fMessage(messageRetour);
        } catch (e) {
          this.fErreur({
            erreur: e.toString() + e.stack.toString(),
            idRequête: id,
          });
        }

        break;
      }
      case "action": {
        const { id, fonction, args } = message;

        const fonctionIPA = this.extraireFonctionIPA(fonction, id);
        if (!fonctionIPA) return; // L'erreur est déjà envoyée par extraireFonctionIPA

        try {
          const résultat = await fonctionIPA(args);
          const messageRetour: MessageActionDIpa = {
            type: "action",
            id,
            résultat,
          };
          this.fMessage(messageRetour);
        } catch (e) {
          this.fErreur({
            erreur: e.toString() + e.stack.toString(),
            idRequête: id,
          });
        }

        break;
      }
      case "retour": {
        const { id, fonction, args } = message;
        const retour = this.dicFRetourSuivi[id];

        if (retour) await retour[fonction](args);
        if (fonction === "fOublier") delete this.dicFRetourSuivi[id];
        break;
      }
      default: {
        this.fErreur({
          erreur: `Type de requête ${type} non reconnu dans message ${message}`,
          idRequête: (message as MessagePourIpa).id,
        });
        break;
      }
    }
  }

  extraireFonctionIPA(
    adresseFonction: string[],
    idMessage: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): ((...args: any[]) => unknown) | undefined {
    const erreur = `Fonction Constellation.${adresseFonction.join(
      ".",
    )} n'existe pas ou n'est pas une fonction.`;

    let fonctionIPA:
      | Constellation
      | Constellation[keyof Constellation]
      | ((args: { [key: string]: unknown }) => Promise<unknown>) = this.ipa;

    for (const [i, attr] of adresseFonction.entries()) {
      // Vive JavaScript et `this`!
      if (i === adresseFonction.length - 1) {
        if (
          typeof fonctionIPA === "object" &&
          attr in fonctionIPA &&
          fonctionIPA[attr as keyof typeof fonctionIPA]
        ) {
          // @ts-expect-error Ça, ça me dépasse
          fonctionIPA = fonctionIPA[attr].bind(fonctionIPA);
        } else {
          this.fErreur({ erreur, idRequête: idMessage });
          return undefined;
        }
      } else {
        if (
          typeof fonctionIPA === "object" &&
          attr in fonctionIPA &&
          fonctionIPA[attr as keyof typeof fonctionIPA]
        ) {
          fonctionIPA = fonctionIPA[attr as keyof typeof fonctionIPA];
        } else {
          this.fErreur({ erreur, idRequête: idMessage });
          return undefined;
        }
      }

      if (!fonctionIPA) {
        this.fErreur({ erreur, idRequête: idMessage });
        return undefined;
      }
    }
    if (typeof fonctionIPA !== "function") {
      this.fErreur({ erreur, idRequête: idMessage });
      return undefined;
    }
    return fonctionIPA;
  }

  connecterÉcouteurs({
    fMessage,
    fErreur,
  }: {
    fMessage: (m: MessageDIpa) => void;
    fErreur: (args: {
      erreur: string;
      idRequête?: string;
      code?: string;
    }) => void;
  }): () => void {
    const idÉcouteurs = uuidv4();
    this.fsMessages[idÉcouteurs] = fMessage;
    this.fsErreurs[idÉcouteurs] = fErreur;
    return () => {
      delete this.fsMessages[idÉcouteurs];
      delete this.fsErreurs[idÉcouteurs];
    };
  }

  async fermer(): Promise<void> {
    // Avant de fermer, il faut être sûr qu'on a bien initialisé !
    const ipa = await this.init();
    await ipa.fermer();
  }
}
