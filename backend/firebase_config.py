import os
import json
import logging

logger = logging.getLogger("talent_exchange.firebase")

FIREBASE_STATUS = "uninitialized"
PROJECT_ID = None
STORAGE_BUCKET = None

_firestore_client = None
_storage_bucket = None

def init_firebase():
    """
    Initializes Firebase Admin SDK with credentials from:
    1. 'serviceAccountKey.json' in the current or backend directory.
    2. 'FIREBASE_SERVICE_ACCOUNT' environment variable (file path or raw JSON string).
    3. Google Application Default Credentials.
    
    If credentials are not present, enters development fallback mode.
    """
    global FIREBASE_STATUS, PROJECT_ID, STORAGE_BUCKET, _firestore_client, _storage_bucket

    # Determine credentials path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    key_path = os.path.join(base_dir, "serviceAccountKey.json")
    env_creds = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    storage_bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET")

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore, storage

        cred = None

        if env_creds:
            if os.path.exists(env_creds):
                cred = credentials.Certificate(env_creds)
                logger.info(f"Loaded Firebase credentials from file: {env_creds}")
            else:
                try:
                    cred_dict = json.loads(env_creds)
                    cred = credentials.Certificate(cred_dict)
                    logger.info("Loaded Firebase credentials from FIREBASE_SERVICE_ACCOUNT JSON string.")
                except Exception as e:
                    logger.warning(f"Could not parse FIREBASE_SERVICE_ACCOUNT as JSON: {e}")

        elif os.path.exists(key_path):
            cred = credentials.Certificate(key_path)
            logger.info(f"Loaded Firebase credentials from: {key_path}")

        if cred:
            if not firebase_admin._apps:
                app_options = {}
                if storage_bucket_name:
                    app_options['storageBucket'] = storage_bucket_name
                elif hasattr(cred, 'project_id') and cred.project_id:
                    app_options['storageBucket'] = f"{cred.project_id}.appspot.com"
                
                firebase_admin.initialize_app(cred, app_options)

            _firestore_client = firestore.client()
            try:
                _storage_bucket = storage.bucket()
                STORAGE_BUCKET = _storage_bucket.name if _storage_bucket else None
            except Exception as e:
                logger.warning(f"Storage bucket init notice: {e}")
                _storage_bucket = None

            PROJECT_ID = cred.project_id
            FIREBASE_STATUS = "connected"
            print(f"[Firebase Admin]: Successfully connected to Firebase Project: '{PROJECT_ID}'")
            return
    except ImportError:
        logger.info("firebase_admin package not installed yet. Running in local fallback mode.")
    except Exception as e:
        logger.warning(f"Failed to initialize live Firebase Admin SDK: {e}")

    # Development Fallback Mode
    FIREBASE_STATUS = "local_dev_fallback"
    PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "talent-exchange-dev")
    STORAGE_BUCKET = storage_bucket_name or f"{PROJECT_ID}.appspot.com"
    print("[Firebase Notice]: Running in local development fallback mode.")
    print("To connect live Firebase, place 'serviceAccountKey.json' in 'backend/' or set FIREBASE_SERVICE_ACCOUNT.")

def get_firestore_client():
    if _firestore_client is None and FIREBASE_STATUS == "uninitialized":
        init_firebase()
    return _firestore_client

def get_storage_bucket():
    if _storage_bucket is None and FIREBASE_STATUS == "uninitialized":
        init_firebase()
    return _storage_bucket

def is_firebase_live():
    return FIREBASE_STATUS == "connected"

def get_firebase_info():
    if FIREBASE_STATUS == "uninitialized":
        init_firebase()
    return {
        "status": FIREBASE_STATUS,
        "is_live": is_firebase_live(),
        "project_id": PROJECT_ID,
        "storage_bucket": STORAGE_BUCKET,
        "mode": "Live Google Cloud Firebase" if is_firebase_live() else "Local Development Mode"
    }

# Auto-initialize on module load
init_firebase()
