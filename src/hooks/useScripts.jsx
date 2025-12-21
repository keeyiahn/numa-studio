import { useState } from 'react';

export default function useScripts() {
    const initialScripts = {
        "even-odd": {
            type: "map",
            data: `
from pynumaflow.mapper import Messages, Message, Datum, MapServer
import json

def my_handler(keys: list[str], datum: Datum) -> Messages:
    val = datum.value
    output_keys = keys
    output_tags = []
    _ = datum.event_time
    _ = datum.watermark
    messages = Messages()
    data = json.loads(val)
    name = data["name"]
    age = data["age"]
    try:
        if int(age):
            output_keys = ["users"]
            output_tags = ["users-tag"]
    except Exception as e:
        output_keys = ["error"]
        output_tags = ["error-tag"]
    
    print(f"val: {data}, key:{output_keys}")
    messages.append(Message(val, keys=output_keys, tags=output_tags))
    return messages

if __name__ == "__main__":
    grpc_server = MapServer(my_handler)
    grpc_server.start()
            `,
        },
        "counter": {
            type: "reduce",
            data: `
import os
from collections.abc import AsyncIterable

from pynumaflow.reducer import Messages, Message, Datum, Metadata, ReduceAsyncServer, Reducer


class ReduceCounter(Reducer):
    def __init__(self, counter):
        self.counter = counter

    async def handler(
        self, keys: list[str], datums: AsyncIterable[Datum], md: Metadata
    ) -> Messages:
        interval_window = md.interval_window
        self.counter = 0
        async for _ in datums:
            self.counter += 1
        msg = (
            f"counter:{self.counter} interval_window_start:{interval_window.start} "
            f"interval_window_end:{interval_window.end}"
        )
        return Messages(Message(str.encode(msg), keys=keys))


async def reduce_handler(keys: list[str], datums: AsyncIterable[Datum], md: Metadata) -> Messages:
    interval_window = md.interval_window
    counter = 0
    async for _ in datums:
        counter += 1
    msg = (
        f"counter:{counter} interval_window_start:{interval_window.start} "
        f"interval_window_end:{interval_window.end}"
    )
    return Messages(Message(str.encode(msg), keys=keys))


if __name__ == "__main__":
    invoke = os.getenv("INVOKE", "func_handler")
    if invoke == "class":
        # Here we are using the class instance as the reducer_instance
        # which will be used to invoke the handler function.
        # We are passing the init_args for the class instance.
        grpc_server = ReduceAsyncServer(ReduceCounter, init_args=(0,))
    else:
        # Here we are using the handler function directly as the reducer_instance.
        grpc_server = ReduceAsyncServer(reduce_handler)
    grpc_server.start()
            `
        }
    }

    const [scripts, setScripts] = useState(initialScripts);


    const addScript = (scriptId, scriptType, scriptData) => {
        setScripts((prevScripts) => ({
            ...prevScripts,
            [scriptId]: {
                type: scriptType,
                data: scriptData
            }
        }));
    };

    const editScript = (scriptId, newId, newConfig) => {
        setScripts((prev) => {
          const script = prev[scriptId];
          if (!script) return prev;
      
          const updatedScript = {
            ...script,
            id: newId,                        // update the template's id field
            data: newConfig,
          };
      
          // Rebuild object with new key
          const { [scriptId]: _, ...rest } = prev;
      
          return {
            ...rest,
            [newId]: updatedScript,         // new key with updated template
          };
        });
      };

    return {
        scripts,
        addScript,
        editScript
    };
}