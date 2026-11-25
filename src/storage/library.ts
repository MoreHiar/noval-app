import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';
import type { LibraryData } from '../sources/management';
import type { Book, ReadingProgress } from '../domain/books';
import { createLibraryDatabase, LEGACY_LIBRARY_KEY } from './library-database';
import { jgwxsDefaultBundle } from '../sources/defaults';

let repository: ReturnType<typeof createLibraryDatabase> | undefined;
function getRepository() {
  repository ??= openDatabaseAsync('noval-library.db').then(db => createLibraryDatabase(db, { defaultBundle: jgwxsDefaultBundle })).catch(error => {
    repository = undefined;
    throw error;
  });
  return repository;
}

export async function loadLibrary(initial: LibraryData): Promise<LibraryData> {
  const db = await getRepository();
  return db.load(initial, () => AsyncStorage.getItem(LEGACY_LIBRARY_KEY));
}

export async function saveLibrary(data: LibraryData): Promise<void> {
  const db = await getRepository();
  await db.save(data);
}

export async function loadShelfBook(sourceId: string, bookId: string): Promise<Book | null> {
  return (await getRepository()).getBook(sourceId, bookId);
}

export async function loadReadingProgress(sourceId: string, bookId: string): Promise<ReadingProgress | null> {
  return (await getRepository()).getProgress(sourceId, bookId);
}

export async function saveReadingProgress(progress: ReadingProgress): Promise<void> {
  await (await getRepository()).saveProgress(progress);
}
