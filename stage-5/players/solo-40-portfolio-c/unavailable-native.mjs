function unavailable(){throw Error('Native bot decision requested in independent mode');}
export const botPickBand=unavailable,botPickCard=unavailable,bountyKillChance=unavailable;
export const botPrepBeginSteps=unavailable,botPrepEndSteps=unavailable,arrangeSteps=unavailable;
export const adaptiveCandidatePlansSteps=unavailable,createDelegatedRehearsalJob=unavailable;
export function createBotPrepSteps(){return {prepBegin:unavailable,prepEnd:unavailable};}
