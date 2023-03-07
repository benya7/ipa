export abstract class Extention {
  abstract ext: string;

  abstract extraireMessages({
    texte,
  }: {
    texte: string;
  }): Promise<{ clef: string; valeur: string }[]>;

  abstract compiler({
    texte,
    traducs,
    fichier,
    langue,
  }: {
    texte: string;
    traducs: { [clef: string]: string };
    fichier: string;
    langue: string;
  }): Promise<string>;
}
