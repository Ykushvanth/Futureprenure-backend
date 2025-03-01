-- -- -- -- Drop the existing users table if it exists
-- DROP TABLE IF EXISTS appointments;
-- SELECT * FROM appointments;
-- -- -- -- Create the users table with the phone_number column
-- -- -- CREATE TABLE IF NOT EXISTS users (
-- -- --     id INTEGER PRIMARY KEY AUTOINCREMENT,
-- -- --     username TEXT UNIQUE NOT NULL,
-- -- --     firstname TEXT,
-- -- --     lastname TEXT,
-- -- --     email TEXT UNIQUE NOT NULL,
-- -- --     date_of_birth TEXT,
-- -- --     gender TEXT,
-- -- --     password TEXT NOT NULL,
-- -- --     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
-- -- --     phone_number TEXT  -- Added phone_number column
-- -- -- );
-- -- -- ALTER TABLE users ADD COLUMN phone_number TEXT;
-- -- -- CREATE TABLE users (
-- -- --     id INTEGER PRIMARY KEY AUTOINCREMENT,
-- -- --     username VARCHAR(50) NOT NULL UNIQUE,
-- -- --     firstname VARCHAR(50) NOT NULL,
-- -- --     lastname VARCHAR(50) NOT NULL,
-- -- --     email VARCHAR(100) NOT NULL UNIQUE,
-- -- --     phoneNumber VARCHAR(15) NOT NULL,
-- -- --     dateOfBirth DATE NOT NULL,
-- -- --     gender VARCHAR(10),
-- -- --     password VARCHAR(255) NOT NULL,
-- -- --     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- -- -- );
-- -- -- SELECT id, username, firstname, lastname, email, phoneNumber, dateOfBirth, gender
-- -- --                                FROM users 
-- -- --                                WHERE id = 2


-- -- -- PRAGMA table_info(users);
-- -- SELECT * FROM doctors;

-- -- SELECT * from users;
-- -- -- .schema users
-- -- -- DROP Table users
-- -- -- npm install express cors sqlite3 bcrypt jsonwebtoken

-- -- -- SELECT id, username, firstname, lastname, email, phoneNumber, dateOfBirth, gender
-- -- -- FROM users
-- -- -- WHERE id = 2;
-- -- .schema doctors
-- -- -- CREATE TABLE doctors (
-- -- --     id INT PRIMARY KEY,
-- -- --     name VARCHAR(255),
-- -- --     specialization VARCHAR(255),
-- -- --     appointment_cost INT,
-- -- --     location VARCHAR(255),
-- -- --     rating FLOAT,
-- -- --     phone_number VARCHAR(15),
-- -- --     location_url VARCHAR(255),
-- -- --     image_url VARCHAR(255)
-- -- -- );
-- -- -- SELECT * FROM doctors
-- -- -- UPDATE doctors
-- -- -- SET location = 'Banjara Hills, Hyderabad'
-- -- -- WHERE id IN (9, 10);


INSERT INTO doctors (id, name, specialization, appointment_cost, location, rating, phone_number, location_url, image_url) VALUES


-- -- -- (99, 'Dr. Kunal Shah', 'Orthopedist', 240, 'Andheri, Mumbai', 4.8, '9876543400', 'https://goo.gl/maps/andheri', 'https://res.cloudinary.com/dbroxheos/image/upload/v1735456384/bwgnpzlaehxkssamntq6.jpg'),
-- -- -- (100, 'Dr. Riya Mehta', 'Orthopedist', 230, 'Powai, Mumbai', 4.7, '9876543401', 'https://goo.gl/maps/powai', 'https://res.cloudinary.com/dbroxheos/image/upload/v1735456244/peyqqdtflgm0qsn3cn8i.jpg');
-- -- --  SELECT  location 
-- -- --  FROM doctors 
-- -- -- ORDER BY location

-- -- CREATE TABLE appointments (
-- --     id INTEGER PRIMARY KEY AUTOINCREMENT,
-- --     doctor_id INTEGER NOT NULL,
-- --     user_id INTEGER NOT NULL,
-- --     patient_name TEXT NOT NULL,
-- --     gender TEXT,
-- --     age INTEGER,
-- --     date TEXT NOT NULL,
-- --     time TEXT NOT NULL,
-- --     phone_number TEXT,
-- --     address TEXT,
-- --     specialist TEXT,
-- --     location TEXT,
-- --     status TEXT DEFAULT 'Upcoming',
-- --     symptoms TEXT,
-- --     prescription TEXT,
-- --     diagnosis TEXT,
-- --     notes TEXT,
-- --     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
-- --     FOREIGN KEY (doctor_id) REFERENCES doctors (id),
-- --     FOREIGN KEY (user_id) REFERENCES users (id)
-- -- );
SELECT * from doctors
-- .schema appointments
-- -- Drop Table appointments
-- -- -- ALTER TABLE doctors ADD COLUMN username VARCHAR(255) ;
-- -- -- ALTER TABLE doctors ADD COLUMN password VARCHAR(255);
-- -- -- ALTER TABLE doctors ADD COLUMN qualification VARCHAR(255);
-- -- -- ALTER TABLE doctors ADD COLUMN experience INT;
-- -- SELECT * FROM appointments
-- -- -- UPDATE doctors 
-- -- -- SET username = 'Sandeep Gupta', 
-- -- --     password = 'Sandeep Gupta', 
-- -- --     qualification = 'MD, DM (Cardiology) - AIIMS, New Delhi', 
-- -- --     experience = 6
-- -- -- WHERE name = 'Dr. Sandeep Gupta';

-- -- -- UPDATE doctors 
-- -- -- SET username = 'Neelam Agarwal', 
-- -- --     password = 'Neelam Agarwal', 
-- -- --     qualification = 'MD, DM (Cardiology) - CMC, Vellore', 
-- -- --     experience = 3
-- -- -- WHERE name = 'Dr. Neelam Agarwal';

-- -- -- UPDATE doctors 
-- -- -- SET username = 'Bharat Reddy', 
-- -- --     password = 'Bharat Reddy', 
-- -- --     qualification = 'MD, DM (Cardiology) - NIMS, Hyderabad', 
-- -- --     experience = 7
-- -- -- WHERE name = 'Dr. Bharat Reddy';

-- -- -- UPDATE doctors 
-- -- -- SET username = 'Shalini Rao', 
-- -- --     password = 'Shalini Rao', 
-- -- --     qualification = 'MD, DM (Cardiology) - KMC, Manipal', 
-- -- --     experience = 5
-- -- -- WHERE name = 'Dr. Shalini Rao';
-- -- SELECT * FROM appointments
-- -- SELECT * FROM doctors

-- -- ALTER TABLE appointments ADD column mode TEXT;
-- -- .schema appointments

-- -- UPDATE users 
-- -- SET email = '99220041418@klu.ac.in'  -- New time in 24-hour format
-- -- WHERE id = 1;  e
SELECT * FROM appointments
UPDATE appointments 
SET time = '01:50'  -- New date in YYYY-MM-DD format
WHERE id = 13;  

-- -- SELECT * FROM users

-- -- -- Add video meeting fields to appointments table
-- -- ALTER TABLE appointments ADD COLUMN video_room_link TEXT;
-- -- ALTER TABLE appointments ADD COLUMN meeting_id TEXT;

-- -- ALTER TABLE appointments DROP COLUMN video_room_link;
-- -- -- Keep meeting_id for WebRTC connection
-- -- ALTER TABLE appointments ADD COLUMN meeting_id TEXT;

SELECT * FROM doctors
SELECT * FROM appointments
-- CREATE TABLE IF NOT EXISTS appointments (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     doctor_id INTEGER NOT NULL,
--     user_id INTEGER NOT NULL,
--     patient_name TEXT NOT NULL,
--     gender TEXT,
--     age INTEGER,
--     date TEXT NOT NULL,
--     time TEXT NOT NULL,
--     phone_number TEXT,
--     address TEXT,
--     specialist TEXT,
--     location TEXT,
--     mode TEXT DEFAULT 'Offline',
--     meeting_id TEXT,
--     status TEXT DEFAULT 'Upcoming',
--     symptoms TEXT,
--     prescription TEXT,
--     diagnosis TEXT,
--     notes TEXT,
--     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (doctor_id) REFERENCES doctors (id),
--     FOREIGN KEY (user_id) REFERENCES users (id)
-- );
PRAGMA table_info(doctors);
.tables


SELECT * from doctors