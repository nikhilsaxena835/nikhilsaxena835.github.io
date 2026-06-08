import requests
import time
import os

COUNTRIES = [
    {'code': 'JP', 'name': 'Japan', 'q_id': 'Q17'},
    {'code': 'IN', 'name': 'India', 'q_id': 'Q668'},
    {'code': 'PK', 'name': 'Pakistan', 'q_id': 'Q843'},
    {'code': 'BD', 'name': 'Bangladesh', 'q_id': 'Q902'},
    {'code': 'KR', 'name': 'South Korea', 'q_id': 'Q884'},
    {'code': 'CN', 'name': 'China', 'q_id': 'Q148'},
    {'code': 'TW', 'name': 'Taiwan', 'q_id': 'Q865'},
    {'code': 'TH', 'name': 'Thailand', 'q_id': 'Q869'},
    {'code': 'ID', 'name': 'Indonesia', 'q_id': 'Q252'},
    {'code': 'PH', 'name': 'Philippines', 'q_id': 'Q928'},
    {'code': 'BR', 'name': 'Brazil', 'q_id': 'Q155'},
    {'code': 'AR', 'name': 'Argentina', 'q_id': 'Q414'},
    {'code': 'MX', 'name': 'Mexico', 'q_id': 'Q96'},
    {'code': 'FR', 'name': 'France', 'q_id': 'Q142'},
    {'code': 'DE', 'name': 'Germany', 'q_id': 'Q183'},
    {'code': 'TR', 'name': 'Turkey', 'q_id': 'Q43'},
    {'code': 'NG', 'name': 'Nigeria', 'q_id': 'Q1033'},
    {'code': 'ZA', 'name': 'South Africa', 'q_id': 'Q258'},
    {'code': 'EG', 'name': 'Egypt', 'q_id': 'Q79'},
    {'code': 'GB', 'name': 'United Kingdom', 'q_id': 'Q145'},
    {'code': 'US', 'name': 'United States', 'q_id': 'Q30'},
]

def get_optimized_artists_by_country(country_q_id, limit=50):
    url = 'https://query.wikidata.org/sparql'
    
    # Highly optimized query to run under 2 seconds per country
    query = f"""
    SELECT DISTINCT ?artist ?artistLabel ?mbid ?sitelinks WHERE {{
      # Force the query engine to filter down to MusicBrainz items immediately
      ?artist wdt:P434 ?mbid .
      
      # Match by country association
      {{ ?artist wdt:P27 wd:{country_q_id} . }} # Country of citizenship
      UNION
      {{ ?artist wdt:P17 wd:{country_q_id} . }} # Country of origin
      
      # Fast direct-match validation for musicians/groups
      {{
        ?artist wdt:P31 wd:Q5 . # Must be a human
        ?artist wdt:P106 ?occupation .
        VALUES ?occupation {{ 
          wd:Q639669   # Musician
          wd:Q177220   # Singer
          wd:Q1074081  # Composer
          wd:Q1148107  # Playback singer
          wd:Q10004169 # Music director
        }}
      }}
      UNION
      {{
        ?artist wdt:P31 wd:Q215380 . # Must be a musical group
      }}

      ?artist wikibase:sitelinks ?sitelinks .
      FILTER(?sitelinks > 5)
      
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }}
    }}
    ORDER BY DESC(?sitelinks)
    LIMIT {limit}
    """
    
    headers = {
        'User-Agent': 'MusicDiscoveryAppBot/1.3 (your@email.com)',
        'Accept': 'application/sparql-results+json'
    }
    
    response = requests.get(url, params={'query': query}, headers=headers)
    response.raise_for_status() 
    
    data = response.json()
    
    artists = []
    for item in data['results']['bindings']:
        artists.append({
            'name': item['artistLabel']['value'],
            'wikidata_url': item['artist']['value'],
            'mbid': item['mbid']['value'],
            'popularity_score': int(item['sitelinks']['value'])
        })
        
    return artists

if __name__ == "__main__":
    output_dir = "country_artist_data"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Starting optimized artist extraction for {len(COUNTRIES)} countries...\n")
    
    for country in COUNTRIES:
        country_name = country['name']
        q_id = country['q_id']
        
        filename = f"{country_name.lower().replace(' ', '_')}.txt"
        filepath = os.path.join(output_dir, filename)
        
        print(f"[{country_name}] Fetching data...")
        
        try:
            artists = get_optimized_artists_by_country(q_id, limit=50)
            
            with open(filepath, 'w', encoding='utf-8') as file:
                file.write(f"--- Top 500 Musical Artists from {country_name} ---\n\n")
                for artist in artists:
                    file.write(f"{artist['name']} | MBID:{artist['mbid']} | Score:{artist['popularity_score']}\n")
            
            print(f"[{country_name}] Success! Saved {len(artists)} artists to {filepath}")
            
        except requests.exceptions.RequestException as e:
            print(f"[{country_name}] ERROR: Failed to fetch data. Details: {e}")
            
        print("Waiting 2 seconds before next request...\n")
        time.sleep(2)

    print("Data extraction complete!")