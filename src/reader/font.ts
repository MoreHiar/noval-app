import * as Font from 'expo-font';

const loaded: string[] = [];
let queue: Promise<unknown> = Promise.resolve();

export function loadReaderFont(url: string): Promise<string> {
  const name = `NovalReader-${url.split('/').pop()!.replace(/[^a-z0-9]/gi, '')}`;
  const operation = queue.then(async () => {
    if (!Font.isLoaded(name)) await Font.loadAsync(name, { uri: url });
    const index = loaded.indexOf(name);
    if (index >= 0) loaded.splice(index, 1);
    loaded.push(name);
    while (loaded.length > 3) await Font.unloadAsync(loaded.shift()!);
    return name;
  });
  queue = operation.catch(() => undefined);
  return operation;
}
