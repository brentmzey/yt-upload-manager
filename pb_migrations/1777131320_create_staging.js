/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const batches = new Collection({
    "id": "pbc_batches",
    "name": "batches",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "id": "text_cid",
        "name": "channel_id",
        "type": "text",
        "required": true,
        "system": false
      },
      {
        "id": "select_status",
        "name": "status",
        "type": "select",
        "required": true,
        "system": false,
        "values": ["pending", "processing", "completed", "failed"]
      },
      {
        "id": "date_scheduled",
        "name": "scheduled_for",
        "type": "date",
        "system": false
      }
    ]
  });

  const staged_videos = new Collection({
    "id": "pbc_staged_videos",
    "name": "staged_videos",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "fields": [
      {
        "id": "rel_batch",
        "name": "batch_id",
        "type": "relation",
        "required": true,
        "system": false,
        "maxSelect": 1,
        "collectionId": "pbc_batches"
      },
      {
        "id": "select_v_status",
        "name": "status",
        "type": "select",
        "required": true,
        "system": false,
        "values": ["idle", "processing", "success", "error"]
      },
      {
        "id": "text_title",
        "name": "title",
        "type": "text",
        "required": true,
        "system": false
      },
      {
        "id": "text_desc_b64",
        "name": "description_brotli_b64",
        "type": "text",
        "system": false
      },
      {
        "id": "select_privacy",
        "name": "privacyStatus",
        "type": "select",
        "required": true,
        "system": false,
        "values": ["public", "private", "unlisted"]
      },
      {
        "id": "text_license",
        "name": "license",
        "type": "text",
        "system": false
      },
      {
        "id": "bool_embed",
        "name": "embeddable",
        "type": "bool",
        "system": false
      },
      {
        "id": "bool_stats",
        "name": "publicStatsViewable",
        "type": "bool",
        "system": false
      },
      {
        "id": "bool_kids",
        "name": "madeForKids",
        "type": "bool",
        "system": false
      },
      {
        "id": "text_tags",
        "name": "tags",
        "type": "json",
        "system": false
      },
      {
        "id": "text_cat",
        "name": "categoryId",
        "type": "text",
        "system": false
      },
      {
        "id": "text_start",
        "name": "scheduledStartTime",
        "type": "date",
        "system": false
      },
      {
        "id": "number_sort",
        "name": "sort_order",
        "type": "number",
        "system": false
      }
    ]
  });

  app.save(batches);
  app.save(staged_videos);
}, (app) => {
  const batches = app.findCollectionByNameOrId("pbc_batches");
  const staged_videos = app.findCollectionByNameOrId("pbc_staged_videos");

  app.delete(staged_videos);
  app.delete(batches);
});
