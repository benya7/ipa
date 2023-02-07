import { EventEmitter, once } from "events";
import type {
  schémaFonctionSuivi,
  schémaFonctionOublier,
} from "@/utils/types.js";

class ÉmetteurUneFois<T> extends EventEmitter {
  doitExister: boolean;
  résultatPrêt: boolean;
  fOublier?: schémaFonctionOublier;
  résultat?: T;
  f: (fSuivi: schémaFonctionSuivi<T>) => Promise<schémaFonctionOublier>;

  constructor(
    f: (fSuivi: schémaFonctionSuivi<T>) => Promise<schémaFonctionOublier>,
    doitExister: boolean
  ) {
    super();
    this.doitExister = doitExister;
    this.résultatPrêt = false;
    this.f = f;
    this.initialiser();
  }

  async initialiser() {
    const fSuivre = async (résultat: T) => {
      if (!this.doitExister || résultat) {
        this.résultat = résultat;
        this.résultatPrêt = true;
        if (this.fOublier) this.lorsquePrêt();
      }
    };

    this.fOublier = await this.f(fSuivre);
    this.lorsquePrêt();
  }

  lorsquePrêt() {
    if (this.résultatPrêt) {
      if (!this.fOublier) throw new Error("Fuite !!");
      if (this.fOublier) this.fOublier();
      this.emit("fini", this.résultat);
    }
  }
}

export const uneFois = async function <T>(
  f: (fSuivi: schémaFonctionSuivi<T>) => Promise<schémaFonctionOublier>,
  doitExister = false
): Promise<T> {
  const émetteur = new ÉmetteurUneFois(f, doitExister);
  const résultat = (await once(émetteur, "fini")) as [T];
  return résultat[0];
};

export const faisRien = async (): Promise<void> => {
  // Rien à faire
};

export const ignorerNonDéfinis = <T>(
  f: schémaFonctionSuivi<T>
): schémaFonctionSuivi<T | undefined> => {
  return async (x: T | undefined) => {
    if (x !== undefined) {
      return await f(x);
    }
  };
};
