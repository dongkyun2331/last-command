import { GAME, PERSONALITIES } from "../config.js";
import { STORY_STAGES } from "../data/StageConfig.js";

const STORAGE_KEY = "last-command-campaign-v1";

function newState() {
  return {
    version: 1,
    currentStageIndex: 0,
    selectedStageIndex: 0,
    completed: false,
    allies: null,
    totalRescued: 0,
    stagesCleared: [],
  };
}

export class CampaignSystem {
  static memoryState = null;

  static load() {
    if (this.memoryState) return structuredClone(this.memoryState);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) return null;
      this.memoryState = parsed;
      return structuredClone(parsed);
    } catch (error) {
      console.warn("Campaign save could not be read.", error);
      return null;
    }
  }

  static save(state) {
    this.memoryState = structuredClone(state);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Campaign progress will remain in memory only.", error);
    }
    return structuredClone(state);
  }

  static ensure() {
    return this.load() ?? this.save(newState());
  }

  static startNew() {
    return this.save(newState());
  }

  static hasProgress() {
    const state = this.load();
    return Boolean(state && (state.currentStageIndex > 0 || state.allies || state.completed));
  }

  static setSelectedStage(index) {
    const state = this.ensure();
    const maxUnlocked = Math.min(state.currentStageIndex, STORY_STAGES.length - 1);
    state.selectedStageIndex = Math.max(0, Math.min(index, maxUnlocked));
    return this.save(state);
  }

  static getCurrentStage() {
    const state = this.ensure();
    const index = Math.min(state.currentStageIndex, STORY_STAGES.length - 1);
    return STORY_STAGES[index];
  }

  static getRoster() {
    const state = this.ensure();
    return state.allies ? structuredClone(state.allies) : null;
  }

  static completeStage(stageId, activeAllies, rescuedThisStage = 0) {
    const state = this.ensure();
    const stage = STORY_STAGES[state.currentStageIndex];
    if (!stage || stage.id !== stageId || state.completed) return state;

    const roster = activeAllies
      .filter((ally) => ally.active)
      .slice(0, GAME.maxAllies)
      .map((ally) => ({
        personality: ally.personality,
        // A partial field recovery prevents an unwinnable campaign death spiral
        // while preserving the cost of a difficult battle.
        hp: Math.min(100, Math.max(65, Math.round(ally.hp + 35))),
      }));

    while (roster.length < 4) {
      roster.push({
        personality: PERSONALITIES[roster.length % PERSONALITIES.length],
        hp: 100,
      });
    }

    state.allies = roster;
    state.totalRescued += rescuedThisStage;
    state.stagesCleared = [...new Set([...state.stagesCleared, stageId])];
    state.currentStageIndex += 1;
    state.completed = state.currentStageIndex >= STORY_STAGES.length;
    state.selectedStageIndex = Math.min(state.currentStageIndex, STORY_STAGES.length - 1);
    return this.save(state);
  }
}
