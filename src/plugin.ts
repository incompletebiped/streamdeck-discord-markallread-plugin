import streamDeck from "@elgato/streamdeck";

import { MarkAllReadAction } from "./actions/mark-all-read";

streamDeck.actions.registerAction(new MarkAllReadAction());
streamDeck.connect();
