import { RootStore } from "./rootStore";
import { Inode, InodeDatabase, Pageable } from "../lib/db";
import { action, computed, observable } from "mobx";

interface SearchParams {
  query: string;
  page: number;
}

interface GetLatestParams {
  page: number;
}

interface UpdateSyncAction {
  inodesSynced: number;
  totalInodes: number;
}

interface UpdateSearchResultsAction {
  data: Inode[];
  total: number;
}

export class InodeStore {
  // search state

  // results of the search request
  @observable
  public searchResults: Inode[] = [];
  // total number of pages from the search result
  @observable
  public pages: number = 1;
  // the number of results to show per page
  public resultsPerPage: number;

  // sync state
  @observable
  public inodesSynced: number = 0;
  @observable
  public totalInodesToSync: number = Infinity;

  // internal
  private rootStore: RootStore;
  private db: InodeDatabase;

  constructor(
    rootStore: RootStore,
    contractAddress: string,
    resultsPerPage: number
  ) {
    this.db = new InodeDatabase(contractAddress);
    this.resultsPerPage = resultsPerPage;
    this.rootStore = rootStore;
  }

  @computed
  public get isDbSyncing(): boolean {
    return this.inodesSynced === this.totalInodesToSync;
  }

  /**
   * Initialize the store to begin syncing.
   */
  public init(): void {
    const initiator = async () => {
      const syncState = await this.db.getSyncState();
      this.updateSyncProgress({
        inodesSynced: syncState.numSynced,
        totalInodes: syncState.total
      });

      this.db.startSync((err, syncState) => {
        if (err) {
          console.warn("Error while syncing:", err);
          return;
        }
        if (!syncState) {
          throw Error("Result must exist");
        }

        this.updateSyncProgress({
          inodesSynced: syncState.numSynced,
          totalInodes: syncState.total
        });
      });
    };

    initiator();
  }

  /**
   * Search for paginated inode results
   * @param params Search parameters
   */
  public async search(params: SearchParams): Promise<void> {
    const limit = this.resultsPerPage;
    const offset = this.resultsPerPage * params.page;

    const searchResults = await this.db.search(params.query, limit, offset);

    this.updateSearchResults({
      total: searchResults.total,
      data: searchResults.data
    });
  }

  /**
   * Get the latest paginated inode results
   * @param params Pagination parameters
   */
  public async getLatest(params: GetLatestParams) {
    const limit = this.resultsPerPage;
    const offset = this.resultsPerPage * params.page;

    const searchResults = await this.db.latest(limit, offset);

    this.updateSearchResults({
      total: searchResults.total,
      data: searchResults.data
    });
  }

  /**
   * Clear the internal db and current results
   */
  public async clear() {
    await this.db.clearData();
    this.searchResults = [];
  }

  @action
  private updateSyncProgress(params: UpdateSyncAction): void {
    this.inodesSynced = params.inodesSynced;
    this.totalInodesToSync = params.totalInodes;
  }

  @action
  private updateSearchResults(params: UpdateSearchResultsAction): void {
    this.searchResults = params.data;
    this.pages = Math.ceil(params.total / this.resultsPerPage);
  }

  @action
  private clearResults() {}
}