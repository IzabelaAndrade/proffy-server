import {Request, Response, query} from 'express';
import db from '../database/conection';
import convertHoursToMinutes from '../utils/convertHoursToMinutes';

interface scheduleItem {
  week_day: number;
  from: string;
  to: string
}

export default class ClassesControllers {
  async index(request: Request, response: Response) {
    const filter = request.query;

    const week_day = filter.week_day as string;
    const subject = filter.subject as string;
    const time = filter.time as string;

    if (!filter.week_day || !filter.subject || !filter.time) {
      return response.status(400).json({
        error: 'Missing filter to search classes'
      })
    }

    const timeInMinutes = convertHoursToMinutes(time);

    const classes = await db('classes')
      .whereExists(function() {
        this.select('class_schedule.*')
          .from('class_schedule')
          .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
          .whereRaw('`class_schedule`.`week_day` = ??', [Number(week_day)])
          .whereRaw('`class_schedule`.`from` <= ??', [Number(timeInMinutes)])
          .whereRaw('`class_schedule`.`to` > ??', [Number(timeInMinutes)])

      })
      .where('classes.subject','=', subject)
      .join('users', 'classes.user_id', '=', 'users.id')
      .select(['classes.*', 'users.*']);

    return response.json(classes);
  }


  async create(request: Request, response: Response) {
    const {
      name,
      avatar,
      whatsapp,
      bio,
      subject,
      cost,
      schedule
    } = request.body;
  
    const trx = await db.transaction();
    
    try {
      const insertedUsersIds =  await trx('users').insert({
        name,
        avatar,
        whatsapp,
        bio
      });
      
      const user_id = insertedUsersIds[0];
      
      const insertedClassIds = await trx('classes').insert({
        subject,
        cost,
        user_id
      });
    
      const class_id = insertedClassIds[0];
    
      const classSchedule = schedule.map((scheduleItem: scheduleItem) => {
        return {
          class_id,
          week_day: scheduleItem.week_day,
          from: convertHoursToMinutes(scheduleItem.from),
          to: convertHoursToMinutes(scheduleItem.to),
    
        }
      })
        
      await trx('class_schedule').insert(classSchedule);
    
      await trx.commit();
      
      return response.status(201).send();
    } catch (err) {
      await trx.rollback();
      console.log(err)
      return response.status(400).json({
        error: 'Unespected error while creating new class'
      })
    }
  
    
  }
}