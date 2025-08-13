from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import os
import motor.motor_asyncio
import uuid
import csv
import io

# MongoDB setup
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
db = client.mood_tracker
moods_collection = db.moods

app = FastAPI(title="Mood Tracker API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class MoodEntry(BaseModel):
    date: date
    mood_type: str
    emoji: str
    notes: Optional[str] = ""

class MoodEntryResponse(BaseModel):
    id: str
    date: date
    mood_type: str
    emoji: str
    notes: str
    timestamp: datetime

# Available moods
MOOD_OPTIONS = [
    {"type": "very_happy", "emoji": "😄", "label": "Very Happy"},
    {"type": "happy", "emoji": "😊", "label": "Happy"},
    {"type": "content", "emoji": "😌", "label": "Content"},
    {"type": "neutral", "emoji": "😐", "label": "Neutral"},
    {"type": "sad", "emoji": "😔", "label": "Sad"},
    {"type": "very_sad", "emoji": "😢", "label": "Very Sad"},
    {"type": "angry", "emoji": "😤", "label": "Angry"},
    {"type": "anxious", "emoji": "😰", "label": "Anxious"},
    {"type": "tired", "emoji": "😴", "label": "Tired"},
    {"type": "excited", "emoji": "🤩", "label": "Excited"}
]

@app.get("/")
async def root():
    return {"message": "Mood Tracker API"}

@app.get("/api/mood-options")
async def get_mood_options():
    return {"moods": MOOD_OPTIONS}

@app.post("/api/moods", response_model=MoodEntryResponse)
async def create_mood_entry(mood: MoodEntry):
    try:
        # Check if mood already exists for this date
        existing_mood = await moods_collection.find_one({"date": mood.date.isoformat()})
        if existing_mood:
            raise HTTPException(status_code=400, detail="Mood entry already exists for this date")
        
        mood_dict = {
            "id": str(uuid.uuid4()),
            "date": mood.date.isoformat(),
            "mood_type": mood.mood_type,
            "emoji": mood.emoji,
            "notes": mood.notes or "",
            "timestamp": datetime.utcnow()
        }
        
        await moods_collection.insert_one(mood_dict)
        return MoodEntryResponse(**mood_dict)
    except Exception as e:
        if "already exists" in str(e):
            raise e
        raise HTTPException(status_code=500, detail=f"Error creating mood entry: {str(e)}")

@app.get("/api/moods", response_model=List[MoodEntryResponse])
async def get_mood_entries():
    try:
        cursor = moods_collection.find({}).sort("date", -1)
        moods = []
        async for mood in cursor:
            mood.pop("_id", None)  # Remove MongoDB _id
            moods.append(MoodEntryResponse(**mood))
        return moods
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching mood entries: {str(e)}")

@app.get("/api/moods/{mood_id}", response_model=MoodEntryResponse)
async def get_mood_entry(mood_id: str):
    try:
        mood = await moods_collection.find_one({"id": mood_id})
        if not mood:
            raise HTTPException(status_code=404, detail="Mood entry not found")
        mood.pop("_id", None)
        return MoodEntryResponse(**mood)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching mood entry: {str(e)}")

@app.put("/api/moods/{mood_id}", response_model=MoodEntryResponse)
async def update_mood_entry(mood_id: str, mood: MoodEntry):
    try:
        existing_mood = await moods_collection.find_one({"id": mood_id})
        if not existing_mood:
            raise HTTPException(status_code=404, detail="Mood entry not found")
        
        updated_mood = {
            "mood_type": mood.mood_type,
            "emoji": mood.emoji,
            "notes": mood.notes or "",
            "timestamp": datetime.utcnow()
        }
        
        await moods_collection.update_one(
            {"id": mood_id},
            {"$set": updated_mood}
        )
        
        # Fetch and return updated mood
        updated_mood_doc = await moods_collection.find_one({"id": mood_id})
        updated_mood_doc.pop("_id", None)
        return MoodEntryResponse(**updated_mood_doc)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating mood entry: {str(e)}")

@app.delete("/api/moods/{mood_id}")
async def delete_mood_entry(mood_id: str):
    try:
        result = await moods_collection.delete_one({"id": mood_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Mood entry not found")
        return {"message": "Mood entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting mood entry: {str(e)}")

@app.get("/api/moods/export/csv")
async def export_moods_csv():
    try:
        cursor = moods_collection.find({}).sort("date", -1)
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Date", "Mood", "Emoji", "Notes", "Timestamp"])
        
        # Write data
        async for mood in cursor:
            writer.writerow([
                mood["date"],
                mood["mood_type"].replace("_", " ").title(),
                mood["emoji"],
                mood["notes"],
                mood["timestamp"].isoformat() if isinstance(mood["timestamp"], datetime) else mood["timestamp"]
            ])
        
        output.seek(0)
        
        # Return CSV as streaming response
        def generate():
            yield output.getvalue()
        
        return StreamingResponse(
            generate(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=mood_tracker_export.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting mood data: {str(e)}")

@app.get("/api/stats")
async def get_mood_stats():
    try:
        # Get total entries
        total_entries = await moods_collection.count_documents({})
        
        # Get mood distribution
        pipeline = [
            {"$group": {"_id": "$mood_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        mood_distribution = []
        async for result in moods_collection.aggregate(pipeline):
            mood_info = next((m for m in MOOD_OPTIONS if m["type"] == result["_id"]), None)
            mood_distribution.append({
                "mood_type": result["_id"],
                "count": result["count"],
                "emoji": mood_info["emoji"] if mood_info else "❓",
                "label": mood_info["label"] if mood_info else result["_id"].title()
            })
        
        return {
            "total_entries": total_entries,
            "mood_distribution": mood_distribution
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching mood stats: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)